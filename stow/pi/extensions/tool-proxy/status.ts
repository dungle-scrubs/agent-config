/**
 * Tool-proxy status indicator for the status bar.
 * Shows connection state: tp:ok (green), tp:... (yellow), tp:err (red), tp:off (gray)
 */

import * as fs from "node:fs";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const STATE_FILE = "/tmp/tool-proxy-state.json";
const TOOL_PROXY_URL = "http://localhost:3100";
const _CHECK_INTERVAL_MS = 10_000; // 10 seconds

// Catppuccin Macchiato Colors
const C_GREEN = "\x1b[38;2;166;218;149m"; // green #a6da95
const C_YELLOW = "\x1b[38;2;245;169;127m"; // peach #f5a97f
const C_RED = "\x1b[38;2;237;135;150m"; // red #ed8796
const C_GRAY = "\x1b[38;2;128;135;162m"; // overlay1 #8087a2
const C_RESET = "\x1b[0m";

/** Tool-proxy connection states */
type ProxyState =
	| "connecting" // Initial connection attempt
	| "connected" // Successfully connected
	| "error" // Connection error
	| "disconnected" // Lost connection
	| "unknown"; // State file not found

/** Structure of the tool-proxy state file */
interface StateFile {
	state: ProxyState;
	timestamp: number;
}

// Store interval on globalThis to clear across reloads
const G = globalThis as any;
if (G.__piToolProxyStatusInterval) {
	clearInterval(G.__piToolProxyStatusInterval);
	G.__piToolProxyStatusInterval = null;
}

/**
 * Checks the current tool-proxy connection status.
 * First attempts to read from state file, then falls back to HTTP health check.
 * @returns An object containing the proxy state and whether the data is stale
 */
async function checkToolProxyStatus(): Promise<{ state: ProxyState; stale: boolean }> {
	// First try reading the state file (if Claude Code or similar writes it)
	try {
		if (fs.existsSync(STATE_FILE)) {
			const content = fs.readFileSync(STATE_FILE, "utf-8");
			const data: StateFile = JSON.parse(content);
			const ageMs = Date.now() - data.timestamp;
			const stale = ageMs > 30_000; // Stale if older than 30s
			return { state: data.state, stale };
		}
	} catch {
		// State file doesn't exist or is invalid, fall through to HTTP check
	}

	// Fall back to HTTP health check
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 3000);

		const response = await fetch(`${TOOL_PROXY_URL}/health`, {
			signal: controller.signal,
		});
		clearTimeout(timeout);

		if (response.ok) {
			return { state: "connected", stale: false };
		}
		return { state: "error", stale: false };
	} catch (err: any) {
		if (err.name === "AbortError") {
			return { state: "connecting", stale: false };
		}
		return { state: "disconnected", stale: false };
	}
}

/**
 * Formats the proxy state into a colored status string.
 * @param state - The current proxy connection state
 * @param stale - Whether the state data is stale (older than 30s)
 * @returns A formatted string with ANSI color codes
 */
function formatStatus(state: ProxyState, stale: boolean): string {
	if (stale && state === "connecting") {
		return `${C_RED}tp:x${C_RESET}`;
	}

	switch (state) {
		case "connecting":
			return `${C_YELLOW}tp:...${C_RESET}`;
		case "connected":
			return `${C_GREEN}tp:ok${C_RESET}`;
		case "error":
			return `${C_RED}tp:err${C_RESET}`;
		case "disconnected":
			return `${C_RED}tp:off${C_RESET}`;
		default:
			return `${C_GRAY}tp:?${C_RESET}`;
	}
}

/**
 * Registers the tool-proxy status extension with Pi.
 * Sets up periodic status checks and event handlers.
 * @param pi - The Pi extension API
 */
export default function toolProxyStatus(pi: ExtensionAPI): void {
	/**
	 * Updates the tool-proxy status in the UI status bar.
	 * @param ctx - The extension context providing UI access
	 */
	async function updateStatus(ctx: any) {
		const { state, stale } = await checkToolProxyStatus();
		ctx.ui.setStatus("tool-proxy", formatStatus(state, stale));
	}

	pi.on("session_start", async (_event, ctx) => {
		// Initial check
		await updateStatus(ctx);

		// Check every 10 seconds
		if (G.__piToolProxyStatusInterval) clearInterval(G.__piToolProxyStatusInterval);
		G.__piToolProxyStatusInterval = setInterval(() => updateStatus(ctx), 10_000);
	});

	pi.on("session_shutdown", async () => {
		if (G.__piToolProxyStatusInterval) {
			clearInterval(G.__piToolProxyStatusInterval);
			G.__piToolProxyStatusInterval = null;
		}
	});

	// Also check after each agent turn (tool-proxy might have been used)
	pi.on("agent_end", async (_event, ctx) => {
		await updateStatus(ctx);
	});
}
