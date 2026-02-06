/**
 * Nested Prompts Extension
 *
 * Registers prompts in subdirectories as `/dir:name` commands.
 * Example: prompts/command/new.md → /command:new
 *
 * Skips files starting with `_` (templates/internal files).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/** Frontmatter parsed from a nested prompt markdown file. */
interface PromptFrontmatter {
	description?: string;
	"argument-hint"?: string;
	[key: string]: unknown;
}

/**
 * Parses YAML frontmatter from prompt content.
 * @param content - Raw prompt content with optional frontmatter
 * @returns Parsed frontmatter object
 */
function parseFrontmatter(content: string): PromptFrontmatter {
	const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
	if (!match) return {};

	const frontmatter: PromptFrontmatter = {};
	const lines = match[1].split("\n");

	for (const line of lines) {
		const colonIndex = line.indexOf(":");
		if (colonIndex === -1) continue;

		const key = line.slice(0, colonIndex).trim();
		const value = line.slice(colonIndex + 1).trim();
		frontmatter[key] = value;
	}

	return frontmatter;
}

/**
 * Substitutes $ARGUMENTS, $@, $1, $2, etc. placeholders with actual arguments.
 * @param content - Prompt content with placeholders
 * @param args - Space-separated argument string
 * @returns Content with substitutions applied
 */
function substituteArguments(content: string, args: string): string {
	const argList = args.split(/\s+/).filter(Boolean);

	// Replace $ARGUMENTS or $@ with all args
	let result = content.replace(/\$ARGUMENTS|\$@/g, args);

	// Replace $1, $2, etc. with specific args
	result = result.replace(/\$(\d+)/g, (_, n) => {
		const index = parseInt(n, 10) - 1; // $1 is first arg
		return argList[index] ?? "";
	});

	// If no substitution markers and args provided, append
	if (!content.includes("$ARGUMENTS") && !content.includes("$@") && !content.match(/\$\d/) && args) {
		result += `\n\nUser: ${args}`;
	}

	return result;
}

/**
 * Discovers prompt files in subdirectories of the prompts folder.
 * @param promptsDir - Root prompts directory to scan
 * @returns Array of prompt metadata with directory, name, and file path
 */
function discoverNestedPrompts(promptsDir: string): Array<{ dir: string; name: string; filePath: string }> {
	const prompts: Array<{ dir: string; name: string; filePath: string }> = [];

	if (!fs.existsSync(promptsDir)) return prompts;

	const entries = fs.readdirSync(promptsDir, { withFileTypes: true });

	for (const entry of entries) {
		if (!entry.isDirectory()) continue;
		if (entry.name.startsWith(".")) continue;

		const subdir = path.join(promptsDir, entry.name);
		const files = fs.readdirSync(subdir);

		for (const file of files) {
			// Skip non-markdown files
			if (!file.endsWith(".md")) continue;
			// Skip templates/internal files starting with _
			if (file.startsWith("_")) continue;

			const name = file.replace(/\.md$/, "");
			prompts.push({
				dir: entry.name,
				name,
				filePath: path.join(subdir, file),
			});
		}
	}

	return prompts;
}

/**
 * Registers prompts in subdirectories as /dir:name commands.
 * @param pi - Extension API for registering commands
 */
export default function (pi: ExtensionAPI) {
	const homeDir = process.env.HOME || process.env.USERPROFILE || "";
	const promptsDir = path.join(homeDir, ".pi", "agent", "prompts");

	const nestedPrompts = discoverNestedPrompts(promptsDir);

	for (const prompt of nestedPrompts) {
		const commandName = `${prompt.dir}:${prompt.name}`;

		// Read frontmatter for description
		let frontmatter: PromptFrontmatter = {};
		let description = `Run ${prompt.dir}/${prompt.name} prompt`;

		try {
			const content = fs.readFileSync(prompt.filePath, "utf-8");
			frontmatter = parseFrontmatter(content);
			if (frontmatter.description) {
				description = frontmatter.description;
			}
			if (frontmatter["argument-hint"]) {
				description += ` ${frontmatter["argument-hint"]}`;
			}
		} catch {
			// Use default description
		}

		pi.registerCommand(commandName, {
			description,
			handler: async (args, cmdCtx) => {
				// Read full prompt content
				let content: string;
				try {
					content = fs.readFileSync(prompt.filePath, "utf-8");
				} catch (_err) {
					cmdCtx.ui.notify(`Failed to read prompt: ${commandName}`, "error");
					return;
				}

				// Remove frontmatter
				content = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "");

				// Substitute arguments
				if (args) {
					content = substituteArguments(content, args);
				}

				// Send as user message to trigger agent response
				pi.sendUserMessage(content);
			},
		});
	}
}
