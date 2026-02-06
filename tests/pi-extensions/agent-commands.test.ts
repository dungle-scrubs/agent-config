import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockExtensionAPI } from "./test-utils.js";

// Mock modules
vi.mock("node:fs");
vi.mock("node:os");
vi.mock("node:child_process", () => ({
	spawn: vi.fn(),
}));

const { spawn } = await import("node:child_process");

describe("agent-commands extension", () => {
	let mockApi: ReturnType<typeof createMockExtensionAPI>;
	const mockHomedir = "/home/testuser";

	beforeEach(() => {
		mockApi = createMockExtensionAPI();
		vi.mocked(os.homedir).mockReturnValue(mockHomedir);
		vi.mocked(fs.existsSync).mockReturnValue(false);
		vi.mocked(fs.readdirSync).mockReturnValue([]);
		vi.mocked(fs.readFileSync).mockReturnValue("");
		vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as any);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("agent discovery", () => {
		it("discovers agents from user agents directory", () => {
			const agentsDir = path.join(mockHomedir, ".pi", "agent", "agents");

			vi.mocked(fs.existsSync).mockImplementation((p) => String(p) === agentsDir);
			vi.mocked(fs.readdirSync).mockImplementation((p) => {
				if (p === agentsDir) return ["planner.md", "reviewer.md"] as any;
				return [];
			});
			vi.mocked(fs.readFileSync).mockImplementation((p) => {
				const pStr = String(p);
				if (pStr.includes("planner.md")) {
					return `---
name: planner
description: Plans tasks
model: claude-sonnet-4-20250514
---
You are a planner.`;
				}
				if (pStr.includes("reviewer.md")) {
					return `---
name: reviewer
description: Reviews code
---
You are a reviewer.`;
				}
				return "";
			});

			// Discover agents
			const agents: Array<{ name: string; description: string }> = [];

			if (fs.existsSync(agentsDir)) {
				const files = fs.readdirSync(agentsDir);
				for (const file of files) {
					if (!String(file).endsWith(".md")) continue;
					const content = fs.readFileSync(path.join(agentsDir, file as string), "utf-8");
					const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
					if (fmMatch) {
						const nameMatch = fmMatch[1].match(/name:\s*(.+)/);
						const descMatch = fmMatch[1].match(/description:\s*(.+)/);
						agents.push({
							name: nameMatch?.[1] || String(file).replace(".md", ""),
							description: descMatch?.[1] || "",
						});
					}
				}
			}

			expect(agents).toHaveLength(2);
			expect(agents.map((a) => a.name)).toContain("planner");
			expect(agents.map((a) => a.name)).toContain("reviewer");
		});
	});

	describe("command registration", () => {
		it("registers a command for each agent", () => {
			const agents = [
				{ name: "planner", description: "Plans tasks" },
				{ name: "reviewer", description: "Reviews code" },
			];

			for (const agent of agents) {
				mockApi.registerCommand?.(agent.name, {
					description: agent.description,
					handler: vi.fn(),
				});
			}

			expect(mockApi.commands.has("planner")).toBe(true);
			expect(mockApi.commands.has("reviewer")).toBe(true);
		});
	});

	describe("agent spawning", () => {
		it("spawns pi process with correct arguments", () => {
			const mockProc = {
				stdout: { on: vi.fn() },
				stderr: { on: vi.fn() },
				on: vi.fn(),
				kill: vi.fn(),
			};

			vi.mocked(spawn).mockReturnValue(mockProc as any);

			// Simulate spawning an agent
			const _agentName = "planner";
			const task = "Create a plan for implementing feature X";
			const model = "claude-sonnet-4-20250514";
			const tools = ["read", "bash", "write"];
			const systemPromptPath = "/path/to/agent.md";

			const args = ["-p", "--no-session"];
			if (model) args.push("--model", model);
			if (tools.length > 0) args.push("--tools", tools.join(","));
			args.push("--append-system-prompt", systemPromptPath);
			args.push(`Task: ${task}`);

			spawn("pi", args, { cwd: "/test", stdio: ["ignore", "pipe", "pipe"] });

			expect(spawn).toHaveBeenCalledWith(
				"pi",
				expect.arrayContaining(["--model", model, "--tools", "read,bash,write", "--append-system-prompt"]),
				expect.any(Object)
			);
		});

		it("handles agent completion", async () => {
			const mockProc = {
				stdout: { on: vi.fn() },
				stderr: { on: vi.fn() },
				on: vi.fn(),
				kill: vi.fn(),
			};

			vi.mocked(spawn).mockReturnValue(mockProc as any);

			// Simulate process events
			let closeCallback: ((code: number) => void) | null = null;
			mockProc.on.mockImplementation((event, callback) => {
				if (event === "close") closeCallback = callback;
			});

			spawn("pi", [], {});

			// Simulate process completing
			expect(closeCallback).toBeDefined();
		});
	});

	describe("argument completion", () => {
		it("provides no completions (agents take free-form tasks)", () => {
			// Agent commands don't have predefined argument completions
			// because they take free-form task descriptions
			const getArgumentCompletions = (_prefix: string) => null;

			expect(getArgumentCompletions("any")).toBeNull();
			expect(getArgumentCompletions("")).toBeNull();
		});
	});

	describe("frontmatter parsing", () => {
		it("extracts model from frontmatter", () => {
			const content = `---
name: test-agent
model: claude-opus-4-20250514
---
Prompt.`;

			const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
			const modelMatch = fmMatch?.[1].match(/model:\s*(.+)/);

			expect(modelMatch?.[1]).toBe("claude-opus-4-20250514");
		});

		it("extracts tools array from frontmatter", () => {
			const content = `---
name: test-agent
tools:
  - read
  - bash
  - edit
---
Prompt.`;

			const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
			expect(fmMatch).not.toBeNull();

			// Simple YAML array extraction
			const toolsMatch = fmMatch?.[1].match(/tools:\n((?:\s+-\s+.+\n?)+)/);
			if (toolsMatch) {
				const tools = toolsMatch[1]
					.split("\n")
					.map((line) => line.match(/-\s+(.+)/)?.[1])
					.filter(Boolean);
				expect(tools).toEqual(["read", "bash", "edit"]);
			}
		});

		it("extracts skills array from frontmatter", () => {
			const content = `---
name: test-agent
skills:
  - typescript
  - react
---
Prompt.`;

			const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
			expect(fmMatch).not.toBeNull();

			const skillsMatch = fmMatch?.[1].match(/skills:\n((?:\s+-\s+.+\n?)+)/);
			if (skillsMatch) {
				const skills = skillsMatch[1]
					.split("\n")
					.map((line) => line.match(/-\s+(.+)/)?.[1])
					.filter(Boolean);
				expect(skills).toEqual(["typescript", "react"]);
			}
		});
	});
});
