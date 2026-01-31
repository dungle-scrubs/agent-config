#!/usr/bin/env npx tsx

/**
 * Group outdated dependencies by their related packages
 *
 * Usage: npx tsx group-deps.ts [project-path]
 *
 * Reads from stdin (output of analyze-deps.ts) or runs analyze-deps directly
 * Output: JSON with grouped dependencies
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

interface OutdatedDep {
	name: string;
	current: string;
	wanted: string;
	latest: string;
	type: "patch" | "minor" | "major";
	depType: "dependencies" | "devDependencies" | "peerDependencies";
	group?: string;
}

interface AnalyzeOutput {
	packageManager: string;
	projectPath: string;
	outdated: OutdatedDep[];
	summary: {
		total: number;
		major: number;
		minor: number;
		patch: number;
	};
}

interface GroupedDep {
	groupName: string;
	packages: OutdatedDep[];
	updateType: "patch" | "minor" | "major";
	targetVersion?: string;
	requiresUserApproval: boolean;
}

interface GroupedOutput {
	packageManager: string;
	projectPath: string;
	groups: GroupedDep[];
	ungrouped: OutdatedDep[];
	summary: {
		totalGroups: number;
		totalPackages: number;
		autoUpdateable: number;
		requiresApproval: number;
	};
}

// Groups where all packages should be at the same version
const SAME_VERSION_GROUPS = new Set(["storybook", "trpc", "tanstack", "prisma"]);

function getMaxUpdateType(deps: OutdatedDep[]): "patch" | "minor" | "major" {
	if (deps.some((d) => d.type === "major")) return "major";
	if (deps.some((d) => d.type === "minor")) return "minor";
	return "patch";
}

function getTargetVersion(groupName: string, deps: OutdatedDep[]): string | undefined {
	if (!SAME_VERSION_GROUPS.has(groupName)) return undefined;

	// For same-version groups, find the most common latest version
	const versions = deps.map((d) => d.latest);
	const versionCounts = versions.reduce<Record<string, number>>((acc, v) => {
		acc[v] = (acc[v] ?? 0) + 1;
		return acc;
	}, {});

	let maxCount = 0;
	let targetVersion: string | undefined;
	for (const [version, count] of Object.entries(versionCounts)) {
		if (count > maxCount) {
			maxCount = count;
			targetVersion = version;
		}
	}

	return targetVersion;
}

function groupDependencies(input: AnalyzeOutput): GroupedOutput {
	const { outdated, packageManager, projectPath } = input;

	// Group by the group field
	const groupMap = new Map<string, OutdatedDep[]>();
	const ungrouped: OutdatedDep[] = [];

	for (const dep of outdated) {
		if (dep.group) {
			const existing = groupMap.get(dep.group) ?? [];
			existing.push(dep);
			groupMap.set(dep.group, existing);
		} else {
			ungrouped.push(dep);
		}
	}

	// Convert map to array of GroupedDep
	const groups: GroupedDep[] = [];

	for (const [groupName, packages] of groupMap) {
		const updateType = getMaxUpdateType(packages);
		groups.push({
			groupName,
			packages,
			updateType,
			targetVersion: getTargetVersion(groupName, packages),
			requiresUserApproval: updateType === "major",
		});
	}

	// Also create "groups" for ungrouped major updates (each as its own group)
	const ungroupedMajor = ungrouped.filter((d) => d.type === "major");
	const ungroupedSafe = ungrouped.filter((d) => d.type !== "major");

	for (const dep of ungroupedMajor) {
		groups.push({
			groupName: dep.name,
			packages: [dep],
			updateType: "major",
			requiresUserApproval: true,
		});
	}

	// Sort groups: major updates requiring approval first
	groups.sort((a, b) => {
		if (a.requiresUserApproval !== b.requiresUserApproval) {
			return a.requiresUserApproval ? -1 : 1;
		}
		return a.groupName.localeCompare(b.groupName);
	});

	const autoUpdateable =
		groups.filter((g) => !g.requiresUserApproval).reduce((sum, g) => sum + g.packages.length, 0) + ungroupedSafe.length;

	const requiresApproval = groups.filter((g) => g.requiresUserApproval).reduce((sum, g) => sum + g.packages.length, 0);

	return {
		packageManager,
		projectPath,
		groups,
		ungrouped: ungroupedSafe,
		summary: {
			totalGroups: groups.length,
			totalPackages: outdated.length,
			autoUpdateable,
			requiresApproval,
		},
	};
}

async function readStdin(): Promise<string> {
	return new Promise((resolve) => {
		let data = "";
		process.stdin.setEncoding("utf8");

		if (process.stdin.isTTY) {
			resolve("");
			return;
		}

		process.stdin.on("readable", () => {
			let chunk;
			while ((chunk = process.stdin.read()) !== null) {
				data += chunk;
			}
		});

		process.stdin.on("end", () => {
			resolve(data);
		});

		// Timeout after 100ms if no data
		setTimeout(() => resolve(data), 100);
	});
}

async function main(): Promise<void> {
	const projectPath = process.argv[2] ?? process.cwd();

	// Try to read from stdin first
	const stdinData = await readStdin();

	let input: AnalyzeOutput;

	if (stdinData.trim()) {
		input = JSON.parse(stdinData);
	} else {
		// Run analyze-deps.ts directly
		const scriptDir = dirname(fileURLToPath(import.meta.url));
		const analyzeScript = join(scriptDir, "analyze-deps.ts");

		if (!existsSync(analyzeScript)) {
			console.error(JSON.stringify({ error: `analyze-deps.ts not found at ${analyzeScript}` }));
			process.exit(1);
		}

		try {
			const output = execSync(`npx tsx "${analyzeScript}" "${projectPath}"`, {
				encoding: "utf-8",
				stdio: ["pipe", "pipe", "pipe"],
			});
			input = JSON.parse(output);
		} catch (error) {
			const err = error as { stderr?: string };
			console.error(JSON.stringify({ error: "Failed to run analyze-deps.ts", details: err.stderr }));
			process.exit(1);
		}
	}

	const grouped = groupDependencies(input);
	console.log(JSON.stringify(grouped, null, 2));
}

main();
