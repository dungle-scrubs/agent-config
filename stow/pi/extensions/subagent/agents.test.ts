import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { discoverAgents } from "./agents.js";

// Mock fs and os modules
vi.mock("node:fs");
vi.mock("node:os");

// Helper to create mock Dirent objects
function createMockDirent(name: string, isFile = true): fs.Dirent {
	return {
		name,
		isFile: () => isFile,
		isDirectory: () => !isFile,
		isSymbolicLink: () => false,
		isBlockDevice: () => false,
		isCharacterDevice: () => false,
		isFIFO: () => false,
		isSocket: () => false,
		path: "",
		parentPath: "",
	};
}

describe("discoverAgents", () => {
	const mockHomedir = "/home/testuser";
	const mockCwd = "/project";

	beforeEach(() => {
		vi.mocked(os.homedir).mockReturnValue(mockHomedir);
		vi.mocked(fs.existsSync).mockReturnValue(false);
		vi.mocked(fs.readdirSync).mockReturnValue([]);
		vi.mocked(fs.readFileSync).mockReturnValue("");
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("discovers agents from user directory", () => {
		const userAgentsDir = path.join(mockHomedir, ".pi", "agent", "agents");

		vi.mocked(fs.existsSync).mockImplementation((p) => p === userAgentsDir);
		vi.mocked(fs.readdirSync).mockImplementation((p) => {
			if (p === userAgentsDir) {
				return [createMockDirent("worker.md"), createMockDirent("reviewer.md")] as any;
			}
			return [];
		});
		vi.mocked(fs.readFileSync).mockImplementation((p) => {
			if (String(p).includes("worker.md")) {
				return `---
name: worker
description: Worker agent
---
Do work.`;
			}
			if (String(p).includes("reviewer.md")) {
				return `---
name: reviewer
description: Review agent
---
Review code.`;
			}
			return "";
		});

		const result = discoverAgents(mockCwd, "user");

		expect(result.agents).toHaveLength(2);
		expect(result.agents.map((a) => a.name)).toContain("worker");
		expect(result.agents.map((a) => a.name)).toContain("reviewer");
		expect(result.agents.every((a) => a.source === "user")).toBe(true);
	});

	it("discovers agents from project directory with scope 'project'", () => {
		const projectAgentsDir = path.join(mockCwd, ".pi", "agents");

		vi.mocked(fs.existsSync).mockImplementation((p) => p === projectAgentsDir);
		vi.mocked(fs.statSync).mockImplementation((p) => {
			if (p === projectAgentsDir) {
				return { isDirectory: () => true } as any;
			}
			throw new Error("ENOENT");
		});
		vi.mocked(fs.readdirSync).mockImplementation((p) => {
			if (p === projectAgentsDir) {
				return [createMockDirent("local-agent.md")] as any;
			}
			return [];
		});
		vi.mocked(fs.readFileSync).mockImplementation((p) => {
			if (String(p).includes("local-agent.md")) {
				return `---
name: local-agent
description: Local agent
---
Local agent prompt.`;
			}
			return "";
		});

		const result = discoverAgents(mockCwd, "project");

		expect(result.agents).toHaveLength(1);
		expect(result.agents[0].name).toBe("local-agent");
		expect(result.agents[0].source).toBe("project");
		expect(result.projectAgentsDir).toBe(projectAgentsDir);
	});

	it("discovers agents from both directories with scope 'both'", () => {
		const userAgentsDir = path.join(mockHomedir, ".pi", "agent", "agents");
		const projectAgentsDir = path.join(mockCwd, ".pi", "agents");

		vi.mocked(fs.existsSync).mockImplementation((p) => p === userAgentsDir || p === projectAgentsDir);
		vi.mocked(fs.statSync).mockImplementation((p) => {
			if (p === userAgentsDir || p === projectAgentsDir) {
				return { isDirectory: () => true } as any;
			}
			throw new Error("ENOENT");
		});
		vi.mocked(fs.readdirSync).mockImplementation((p) => {
			if (p === userAgentsDir) return [createMockDirent("user-agent.md")] as any;
			if (p === projectAgentsDir) return [createMockDirent("project-agent.md")] as any;
			return [];
		});
		vi.mocked(fs.readFileSync).mockImplementation((p) => {
			if (String(p).includes("user-agent.md")) {
				return `---
name: user-agent
description: User agent
---
User agent.`;
			}
			if (String(p).includes("project-agent.md")) {
				return `---
name: project-agent
description: Project agent
---
Project agent.`;
			}
			return "";
		});

		const result = discoverAgents(mockCwd, "both");

		expect(result.agents).toHaveLength(2);
		expect(result.agents.find((a) => a.name === "user-agent")?.source).toBe("user");
		expect(result.agents.find((a) => a.name === "project-agent")?.source).toBe("project");
	});

	it("ignores non-.md files", () => {
		const userAgentsDir = path.join(mockHomedir, ".pi", "agent", "agents");

		vi.mocked(fs.existsSync).mockImplementation((p) => p === userAgentsDir);
		vi.mocked(fs.readdirSync).mockImplementation((p) => {
			if (p === userAgentsDir) {
				return [
					createMockDirent("agent.md"),
					createMockDirent("readme.txt"),
					createMockDirent("config.json"),
				] as any;
			}
			return [];
		});
		vi.mocked(fs.readFileSync).mockImplementation((p) => {
			if (String(p).includes("agent.md")) {
				return `---
name: valid-agent
description: Valid agent
---
Prompt.`;
			}
			return "";
		});

		const result = discoverAgents(mockCwd, "user");

		expect(result.agents).toHaveLength(1);
		expect(result.agents[0].name).toBe("valid-agent");
	});

	it("ignores agents without name or description", () => {
		const userAgentsDir = path.join(mockHomedir, ".pi", "agent", "agents");

		vi.mocked(fs.existsSync).mockImplementation((p) => p === userAgentsDir);
		vi.mocked(fs.readdirSync).mockImplementation((p) => {
			if (p === userAgentsDir) {
				return [createMockDirent("incomplete.md"), createMockDirent("valid.md")] as any;
			}
			return [];
		});
		vi.mocked(fs.readFileSync).mockImplementation((p) => {
			if (String(p).includes("incomplete.md")) {
				return `---
name: incomplete
---
No description.`;
			}
			if (String(p).includes("valid.md")) {
				return `---
name: valid
description: Has description
---
Prompt.`;
			}
			return "";
		});

		const result = discoverAgents(mockCwd, "user");

		expect(result.agents).toHaveLength(1);
		expect(result.agents[0].name).toBe("valid");
	});

	it("parses tools from frontmatter", () => {
		const userAgentsDir = path.join(mockHomedir, ".pi", "agent", "agents");

		vi.mocked(fs.existsSync).mockImplementation((p) => p === userAgentsDir);
		vi.mocked(fs.readdirSync).mockImplementation((p) => {
			if (p === userAgentsDir) return [createMockDirent("with-tools.md")] as any;
			return [];
		});
		vi.mocked(fs.readFileSync).mockImplementation((p) => {
			if (String(p).includes("with-tools.md")) {
				return `---
name: with-tools
description: Has tools
tools: read, bash, edit
---
Prompt.`;
			}
			return "";
		});

		const result = discoverAgents(mockCwd, "user");

		expect(result.agents).toHaveLength(1);
		expect(result.agents[0].tools).toEqual(["read", "bash", "edit"]);
	});

	it("parses model from frontmatter", () => {
		const userAgentsDir = path.join(mockHomedir, ".pi", "agent", "agents");

		vi.mocked(fs.existsSync).mockImplementation((p) => p === userAgentsDir);
		vi.mocked(fs.readdirSync).mockImplementation((p) => {
			if (p === userAgentsDir) return [createMockDirent("with-model.md")] as any;
			return [];
		});
		vi.mocked(fs.readFileSync).mockImplementation((p) => {
			if (String(p).includes("with-model.md")) {
				return `---
name: with-model
description: Has model
model: claude-sonnet-4-20250514
---
Prompt.`;
			}
			return "";
		});

		const result = discoverAgents(mockCwd, "user");

		expect(result.agents).toHaveLength(1);
		expect(result.agents[0].model).toBe("claude-sonnet-4-20250514");
	});

	it("returns empty array when directory does not exist", () => {
		vi.mocked(fs.existsSync).mockReturnValue(false);

		const result = discoverAgents(mockCwd, "user");

		expect(result.agents).toHaveLength(0);
	});
});
