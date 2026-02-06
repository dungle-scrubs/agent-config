import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

const INIT_PROMPT = `Please analyze this codebase and create a CLAUDE.md file, which will be given to future instances of Claude Code to operate in this repository.

What to add:
1. Commands that will be commonly used, such as how to build, lint, and run tests. Include the necessary commands to develop in this codebase, such as how to run a single test.
2. High-level code architecture and structure so that future instances can be productive more quickly. Focus on the "big picture" architecture that requires reading multiple files to understand.

Usage notes:
- If there's already a CLAUDE.md, suggest improvements to it.
- When you make the initial CLAUDE.md, do not repeat yourself and do not include obvious instructions like "Provide helpful error messages to users", "Write unit tests for all new utilities", "Never include sensitive information (API keys, tokens) in code or commits".
- Avoid listing every component or file structure that can be easily discovered.
- Don't include generic development practices.
- If there are Cursor rules (in .cursor/rules/ or .cursorrules) or Copilot rules (in .github/copilot-instructions.md), make sure to include the important parts.
- If there is a README.md, make sure to include the important parts.
- Do not make up information such as "Common Development Tasks", "Tips for Development", "Support and Documentation" unless this is expressly included in other files that you read.
- Be sure to prefix the file with the following text:

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.`;

/**
 * Registers /init command to create or improve CLAUDE.md for a project.
 * @param pi - Extension API for registering commands
 */
export default function (pi: ExtensionAPI) {
	pi.registerCommand("init", {
		description: "Initialize CLAUDE.md for the current project",
		handler: async (_args, ctx) => {
			const cwd = ctx.cwd;
			const claudeMdPath = path.join(cwd, "CLAUDE.md");
			const agentsMdPath = path.join(cwd, "AGENTS.md");

			// Check if either file exists
			const claudeExists = fs.existsSync(claudeMdPath);
			const agentsExists = fs.existsSync(agentsMdPath);

			const prompt = INIT_PROMPT;

			if (claudeExists || agentsExists) {
				const existingFile = claudeExists ? "CLAUDE.md" : "AGENTS.md";
				ctx.ui.notify(`Found existing ${existingFile} - will suggest improvements`, "info");
			} else {
				ctx.ui.notify("Analyzing codebase to create CLAUDE.md...", "info");
			}

			// Send the prompt to the agent
			pi.sendUserMessage(prompt);
		},
	});
}
