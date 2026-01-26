#!/usr/bin/env python3
"""
Shared Playwright MCP session manager for Claude Code skills.
Spawns Playwright MCP as subprocess, communicates via JSON-RPC over stdin/stdout.
"""

import base64
import json
import queue
import subprocess
import sys
import threading
from datetime import datetime
from pathlib import Path
from typing import Any


def find_chromium_executable() -> str | None:
    """Find Playwright's installed Chromium executable."""
    cache_dir = Path.home() / "Library/Caches/ms-playwright"
    if not cache_dir.exists():
        return None

    chromium_dirs = sorted(
        cache_dir.glob("chromium-*"), key=lambda p: p.stat().st_mtime, reverse=True
    )
    for chromium_dir in chromium_dirs:
        mac_path = chromium_dir / "chrome-mac/Chromium.app/Contents/MacOS/Chromium"
        if mac_path.exists():
            return str(mac_path)
        linux_path = chromium_dir / "chrome-linux/chrome"
        if linux_path.exists():
            return str(linux_path)
    return None


class PlaywrightSession:
    """Manages a persistent Playwright MCP browser session."""

    def __init__(self, output_dir: str | None = None):
        self.process: subprocess.Popen | None = None
        self.msg_id = 1
        self.pending_responses: dict[int, queue.Queue] = {}
        self.stdout_thread: threading.Thread | None = None
        self.stderr_thread: threading.Thread | None = None
        self.running = False
        self.output_dir = Path(output_dir) if output_dir else Path.cwd()
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def start(self, headless: bool = False) -> "PlaywrightSession":
        """Start Playwright MCP server."""
        print("Starting Playwright browser...")

        try:
            cmd = ["npx", "-y", "@playwright/mcp@latest"]
            if headless:
                cmd.append("--headless")

            chromium_path = find_chromium_executable()
            if chromium_path:
                cmd.extend(["--executable-path", chromium_path])
            else:
                print("Warning: Chromium not found, run: npx playwright install chromium")

            self.process = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
            )

            self.running = True
            self.stdout_thread = threading.Thread(target=self._read_stdout, daemon=True)
            self.stderr_thread = threading.Thread(target=self._read_stderr, daemon=True)
            self.stdout_thread.start()
            self.stderr_thread.start()

            self._initialize()
            print(f"Browser ready. Screenshots: {self.output_dir}\n")
            return self

        except FileNotFoundError:
            print("ERROR: npx not found. Install Node.js.")
            sys.exit(1)
        except Exception as e:
            print(f"ERROR: {e}")
            sys.exit(1)

    def _read_stdout(self):
        if not self.process or not self.process.stdout:
            return
        for line in self.process.stdout:
            line = line.strip()
            if not line:
                continue
            try:
                msg = json.loads(line)
                if "id" in msg and msg["id"] in self.pending_responses:
                    self.pending_responses[msg["id"]].put(msg)
            except json.JSONDecodeError:
                pass

    def _read_stderr(self):
        if not self.process or not self.process.stderr:
            return
        for line in self.process.stderr:
            line = line.strip()
            if line and "Debugger" not in line:
                print(f"[browser] {line}", file=sys.stderr)

    def _initialize(self):
        response = self._send_request(
            "initialize",
            {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "playwright-session", "version": "1.0.0"},
            },
        )
        if "error" in response:
            raise RuntimeError(f"Initialize failed: {response['error']}")

    def _send_request(
        self, method: str, params: dict[str, Any] | None = None, timeout: int = 60
    ) -> dict[str, Any]:
        if not self.process or not self.process.stdin:
            raise RuntimeError("Server not started")

        msg_id = self.msg_id
        self.msg_id += 1
        response_queue: queue.Queue = queue.Queue()
        self.pending_responses[msg_id] = response_queue

        request = {"jsonrpc": "2.0", "method": method, "params": params or {}, "id": msg_id}

        try:
            self.process.stdin.write(json.dumps(request) + "\n")
            self.process.stdin.flush()
        except Exception as e:
            del self.pending_responses[msg_id]
            raise RuntimeError(f"Send failed: {e}")

        try:
            response = response_queue.get(timeout=timeout)
            del self.pending_responses[msg_id]
            return response
        except queue.Empty:
            del self.pending_responses[msg_id]
            raise TimeoutError(f"Request timed out after {timeout}s")

    def call_tool(self, name: str, arguments: dict[str, Any], timeout: int = 60) -> dict[str, Any]:
        """Call a Playwright tool."""
        return self._send_request("tools/call", {"name": name, "arguments": arguments}, timeout)

    def navigate(self, url: str) -> str:
        """Navigate to URL, return page snapshot."""
        result = self.call_tool("browser_navigate", {"url": url})
        return self._extract_text(result)

    def snapshot(self) -> str:
        """Get current page accessibility snapshot."""
        result = self.call_tool("browser_snapshot", {})
        return self._extract_text(result)

    def click(self, element: str, ref: str) -> str:
        """Click an element by ref."""
        result = self.call_tool("browser_click", {"element": element, "ref": ref})
        return self._extract_text(result)

    def type_text(self, element: str, ref: str, text: str, submit: bool = False) -> str:
        """Type into an element."""
        result = self.call_tool(
            "browser_type", {"element": element, "ref": ref, "text": text, "submit": submit}
        )
        return self._extract_text(result)

    def screenshot(self, name: str | None = None, full_page: bool = False) -> str:
        """Take screenshot, save to output directory. Returns file path."""
        if not name:
            name = datetime.now().strftime("%Y%m%d_%H%M%S")
        if not name.endswith(".png"):
            name += ".png"

        filepath = self.output_dir / name
        result = self.call_tool("browser_take_screenshot", {"fullPage": full_page})

        if "result" in result and "content" in result["result"]:
            for item in result["result"]["content"]:
                if item.get("type") == "image":
                    img_data = base64.b64decode(item.get("data", ""))
                    filepath.write_bytes(img_data)
                    print(f"Screenshot saved: {filepath}")
                    return str(filepath)

        return f"Screenshot failed: {result}"

    def evaluate(self, script: str) -> str:
        """Execute JavaScript on the page."""
        result = self.call_tool("browser_evaluate", {"function": script})
        return self._extract_text(result)

    def resize(self, width: int, height: int) -> str:
        """Resize browser window."""
        result = self.call_tool("browser_resize", {"width": width, "height": height})
        return self._extract_text(result)

    def _extract_text(self, result: dict) -> str:
        """Extract text content from MCP response."""
        if "error" in result:
            return f"Error: {result['error']}"
        if "result" in result and "content" in result["result"]:
            texts = []
            for item in result["result"]["content"]:
                if item.get("type") == "text":
                    texts.append(item.get("text", ""))
            return "\n".join(texts)
        return json.dumps(result, indent=2)

    def stop(self):
        """Stop the browser."""
        self.running = False
        if self.process:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
            print("Browser closed.")
