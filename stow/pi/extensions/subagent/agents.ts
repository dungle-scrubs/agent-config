/**
 * Agent discovery and configuration utilities.
 * Loads agent definitions from user (~/.pi/agent/agents) and project (.pi/agents) directories.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { parseFrontmatter } from "@mariozechner/pi-coding-agent";

/** Scope for agent discovery */
export type AgentScope = "user" | "project" | "both";

/** Configuration for a discovered agent */
export interface AgentConfig {
	name: string;
	description: string;
	tools?: string[];
	skills?: string[];
	model?: string;
	systemPrompt: string;
	source: "user" | "project";
	filePath: string;
}

/** Result of agent discovery */
export interface AgentDiscoveryResult {
	agents: AgentConfig[];
	projectAgentsDir: string | null;
}

/**
 * Loads agent configurations from a directory.
 * @param dir - Directory path to search for agent .md files
 * @param source - Whether this is a user or project directory
 * @returns Array of agent configurations found
 */
function loadAgentsFromDir(dir: string, source: "user" | "project"): AgentConfig[] {
	const agents: AgentConfig[] = [];

	if (!fs.existsSync(dir)) {
		return agents;
	}

	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return agents;
	}

	for (const entry of entries) {
		if (!entry.name.endsWith(".md")) continue;
		if (!entry.isFile() && !entry.isSymbolicLink()) continue;

		const filePath = path.join(dir, entry.name);
		let content: string;
		try {
			content = fs.readFileSync(filePath, "utf-8");
		} catch {
			continue;
		}

		const { frontmatter, body } = parseFrontmatter<Record<string, string>>(content);

		if (!frontmatter.name || !frontmatter.description) {
			continue;
		}

		const tools = frontmatter.tools
			?.split(",")
			.map((t: string) => t.trim())
			.filter(Boolean);

		// Parse skills - can be comma-separated string or already an array
		let skills: string[] | undefined;
		if (frontmatter.skills) {
			if (Array.isArray(frontmatter.skills)) {
				skills = frontmatter.skills.map((s: string) => s.trim()).filter(Boolean);
			} else if (typeof frontmatter.skills === "string") {
				skills = frontmatter.skills
					.split(",")
					.map((s: string) => s.trim())
					.filter(Boolean);
			}
		}

		agents.push({
			name: frontmatter.name,
			description: frontmatter.description,
			tools: tools && tools.length > 0 ? tools : undefined,
			skills: skills && skills.length > 0 ? skills : undefined,
			model: frontmatter.model,
			systemPrompt: body,
			source,
			filePath,
		});
	}

	return agents;
}

/**
 * Checks if a path is a directory.
 * @param p - Path to check
 * @returns true if the path exists and is a directory
 */
function isDirectory(p: string): boolean {
	try {
		return fs.statSync(p).isDirectory();
	} catch {
		return false;
	}
}

/**
 * Finds the nearest .pi/agents directory by traversing up from cwd.
 * @param cwd - Starting directory
 * @returns Path to project agents directory or null if not found
 */
function findNearestProjectAgentsDir(cwd: string): string | null {
	let currentDir = cwd;
	while (true) {
		const candidate = path.join(currentDir, ".pi", "agents");
		if (isDirectory(candidate)) return candidate;

		const parentDir = path.dirname(currentDir);
		if (parentDir === currentDir) return null;
		currentDir = parentDir;
	}
}

/**
 * Discovers available agents based on the specified scope.
 * @param cwd - Current working directory for project agent discovery
 * @param scope - Which agent sources to include (user, project, or both)
 * @returns Discovery result with agents and project directory path
 */
export function discoverAgents(cwd: string, scope: AgentScope): AgentDiscoveryResult {
	const userDir = path.join(os.homedir(), ".pi", "agent", "agents");
	const projectAgentsDir = findNearestProjectAgentsDir(cwd);

	const userAgents = scope === "project" ? [] : loadAgentsFromDir(userDir, "user");
	const projectAgents = scope === "user" || !projectAgentsDir ? [] : loadAgentsFromDir(projectAgentsDir, "project");

	const agentMap = new Map<string, AgentConfig>();

	if (scope === "both") {
		for (const agent of userAgents) agentMap.set(agent.name, agent);
		for (const agent of projectAgents) agentMap.set(agent.name, agent);
	} else if (scope === "user") {
		for (const agent of userAgents) agentMap.set(agent.name, agent);
	} else {
		for (const agent of projectAgents) agentMap.set(agent.name, agent);
	}

	return { agents: Array.from(agentMap.values()), projectAgentsDir };
}

/**
 * Formats a list of agents for display.
 * @param agents - Array of agents to format
 * @param maxItems - Maximum number of agents to include in the text
 * @returns Formatted text and count of remaining agents
 */
export function formatAgentList(agents: AgentConfig[], maxItems: number): { text: string; remaining: number } {
	if (agents.length === 0) return { text: "none", remaining: 0 };
	const listed = agents.slice(0, maxItems);
	const remaining = agents.length - listed.length;
	return {
		text: listed.map((a) => `${a.name} (${a.source}): ${a.description}`).join("; "),
		remaining,
	};
}
