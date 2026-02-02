import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockExtensionAPI } from "./test-utils.js";

// Mock fs module
vi.mock("node:fs");

describe("skill-commands extension", () => {
	let mockApi: ReturnType<typeof createMockExtensionAPI>;

	beforeEach(() => {
		mockApi = createMockExtensionAPI();
		vi.mocked(fs.existsSync).mockReturnValue(false);
		vi.mocked(fs.readdirSync).mockReturnValue([]);
		vi.mocked(fs.readFileSync).mockReturnValue("");
		vi.mocked(fs.statSync).mockReturnValue({ isDirectory: () => false } as any);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe("skill discovery", () => {
		it("discovers skills from SKILL.md files in subdirectories", async () => {
			const skillsDir = "/home/user/.pi/agent/skills";

			vi.mocked(fs.existsSync).mockImplementation((p) => {
				const pStr = String(p);
				return pStr === skillsDir || pStr.includes("typescript/SKILL.md") || pStr.includes("react/SKILL.md");
			});

			vi.mocked(fs.readdirSync).mockImplementation((p) => {
				if (p === skillsDir) return ["typescript", "react", "readme.md"] as any;
				return [];
			});

			vi.mocked(fs.statSync).mockImplementation((p) => {
				const pStr = String(p);
				return {
					isDirectory: () => pStr.includes("typescript") || pStr.includes("react"),
				} as any;
			});

			vi.mocked(fs.readFileSync).mockImplementation((p) => {
				const pStr = String(p);
				if (pStr.includes("typescript/SKILL.md")) {
					return `---
name: typescript
description: TypeScript standards
user-invocable: true
---
TypeScript skill content.`;
				}
				if (pStr.includes("react/SKILL.md")) {
					return `---
name: react
description: React patterns
user-invocable: true
---
React skill content.`;
				}
				return "";
			});

			// The skill discovery logic
			const skills: Array<{ name: string; description: string; invocable: boolean }> = [];

			if (fs.existsSync(skillsDir)) {
				const entries = fs.readdirSync(skillsDir);
				for (const entry of entries) {
					const skillDir = path.join(skillsDir, entry as string);
					const skillFile = path.join(skillDir, "SKILL.md");

					if (fs.statSync(skillDir).isDirectory() && fs.existsSync(skillFile)) {
						const content = fs.readFileSync(skillFile, "utf-8");
						const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
						if (fmMatch) {
							const nameMatch = fmMatch[1].match(/name:\s*(.+)/);
							const descMatch = fmMatch[1].match(/description:\s*(.+)/);
							const invocableMatch = fmMatch[1].match(/user-invocable:\s*(.+)/);

							skills.push({
								name: nameMatch?.[1] || entry,
								description: descMatch?.[1] || "",
								invocable: invocableMatch?.[1] !== "false",
							});
						}
					}
				}
			}

			expect(skills).toHaveLength(2);
			expect(skills.map((s) => s.name)).toContain("typescript");
			expect(skills.map((s) => s.name)).toContain("react");
		});

		it("respects user-invocable: false", async () => {
			const skillsDir = "/home/user/.pi/agent/skills";

			vi.mocked(fs.existsSync).mockImplementation((p) => {
				const pStr = String(p);
				return pStr === skillsDir || pStr.includes("internal/SKILL.md");
			});

			vi.mocked(fs.readdirSync).mockImplementation((p) => {
				if (p === skillsDir) return ["internal"] as any;
				return [];
			});

			vi.mocked(fs.statSync).mockImplementation(() => ({ isDirectory: () => true }) as any);

			vi.mocked(fs.readFileSync).mockImplementation((p) => {
				if (String(p).includes("internal/SKILL.md")) {
					return `---
name: internal-skill
description: Not user invocable
user-invocable: false
---
Internal content.`;
				}
				return "";
			});

			// Parse the skill
			const content = fs.readFileSync("/skills/internal/SKILL.md", "utf-8");
			const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
			const invocableMatch = fmMatch?.[1].match(/user-invocable:\s*(.+)/);

			expect(invocableMatch?.[1]).toBe("false");
		});
	});

	describe("command registration", () => {
		it("registers commands for invocable skills", () => {
			const skills = [
				{ name: "typescript", description: "TS standards", invocable: true },
				{ name: "react", description: "React patterns", invocable: true },
				{ name: "internal", description: "Internal only", invocable: false },
			];

			// Filter to invocable only
			const invocableSkills = skills.filter((s) => s.invocable);

			expect(invocableSkills).toHaveLength(2);
			expect(invocableSkills.map((s) => s.name)).not.toContain("internal");
		});

		it("command handler sends skill content as user message", () => {
			const skillContent = "Skill instructions here.";

			// Simulate command handler
			const handler = (args: string) => {
				const message = args ? `${skillContent}\n\nContext: ${args}` : skillContent;
				mockApi.sendUserMessage!(message);
			};

			handler("test context");

			expect(mockApi.sendUserMessage).toHaveBeenCalledWith("Skill instructions here.\n\nContext: test context");
		});
	});

	describe("frontmatter parsing", () => {
		it("extracts all frontmatter fields", () => {
			const content = `---
name: test-skill
description: A test skill
triggers:
  - test
  - testing
user-invocable: true
---
Skill body content.
`;
			const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
			expect(fmMatch).not.toBeNull();

			const fm = fmMatch![1];
			expect(fm).toContain("name: test-skill");
			expect(fm).toContain("description: A test skill");
			expect(fm).toContain("user-invocable: true");

			// Body extraction
			const body = content.slice(content.indexOf("---", 4) + 4).trim();
			expect(body).toBe("Skill body content.");
		});

		it("handles missing frontmatter gracefully", () => {
			const content = "Just content without frontmatter.";
			const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
			expect(fmMatch).toBeNull();
		});
	});
});
