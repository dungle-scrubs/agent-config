#!/usr/bin/env npx tsx

/**
 * Analyze outdated dependencies in a TypeScript/JavaScript project
 *
 * Usage: npx tsx analyze-deps.ts [project-path]
 *
 * Output: JSON array of OutdatedDep objects to stdout
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

interface OutdatedDep {
	name: string;
	current: string;
	wanted: string;
	latest: string;
	type: "patch" | "minor" | "major";
	depType: "dependencies" | "devDependencies" | "peerDependencies";
	group?: string;
}

interface PackageJson {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
	peerDependencies?: Record<string, string>;
}

type PackageManager = "npm" | "pnpm" | "yarn";

const DEPENDENCY_GROUPS: Record<string, RegExp[]> = {
	storybook: [/^@storybook\//, /^storybook$/],
	react: [/^react$/, /^react-dom$/, /^@types\/react/],
	eslint: [/^eslint$/, /^@eslint\//, /^eslint-/],
	typescript: [/^typescript$/],
	"testing-library": [/^@testing-library\//],
	vite: [/^vite$/, /^@vitejs\//, /^vite-/],
	nextjs: [/^next$/, /^@next\//, /^eslint-config-next$/],
	tailwind: [/^tailwindcss$/, /^@tailwindcss\//, /^postcss$/, /^autoprefixer$/],
	prisma: [/^prisma$/, /^@prisma\//],
	trpc: [/^@trpc\//],
	tanstack: [/^@tanstack\//],
	radix: [/^@radix-ui\//],
};

function detectPackageManager(projectPath: string): PackageManager {
	if (existsSync(join(projectPath, "pnpm-lock.yaml"))) {
		return "pnpm";
	}
	if (existsSync(join(projectPath, "yarn.lock"))) {
		return "yarn";
	}
	return "npm";
}

function getDepType(name: string, pkg: PackageJson): "dependencies" | "devDependencies" | "peerDependencies" {
	if (pkg.dependencies?.[name]) return "dependencies";
	if (pkg.devDependencies?.[name]) return "devDependencies";
	if (pkg.peerDependencies?.[name]) return "peerDependencies";
	return "dependencies";
}

function getGroup(name: string): string | undefined {
	for (const [group, patterns] of Object.entries(DEPENDENCY_GROUPS)) {
		if (patterns.some((pattern) => pattern.test(name))) {
			return group;
		}
	}
	return undefined;
}

function classifySemverChange(current: string, latest: string): "patch" | "minor" | "major" {
	const cleanVersion = (v: string): string => v.replace(/^[\^~>=<]+/, "").split("-")[0] ?? v;

	const currentClean = cleanVersion(current);
	const latestClean = cleanVersion(latest);

	const [currentMajor = "0", currentMinor = "0"] = currentClean.split(".");
	const [latestMajor = "0", latestMinor = "0"] = latestClean.split(".");

	if (currentMajor !== latestMajor) return "major";
	if (currentMinor !== latestMinor) return "minor";
	return "patch";
}

interface NpmOutdatedEntry {
	current?: string;
	wanted?: string;
	latest?: string;
}

function getOutdatedNpm(projectPath: string): OutdatedDep[] {
	const pkgPath = join(projectPath, "package.json");
	const pkg: PackageJson = JSON.parse(readFileSync(pkgPath, "utf-8"));

	try {
		const output = execSync("npm outdated --json", {
			cwd: projectPath,
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		});

		const outdated: Record<string, NpmOutdatedEntry> = JSON.parse(output || "{}");
		return Object.entries(outdated).map(([name, info]) => ({
			name,
			current: info.current ?? "unknown",
			wanted: info.wanted ?? info.current ?? "unknown",
			latest: info.latest ?? info.current ?? "unknown",
			type: classifySemverChange(info.current ?? "0.0.0", info.latest ?? "0.0.0"),
			depType: getDepType(name, pkg),
			group: getGroup(name),
		}));
	} catch (error) {
		// npm outdated exits with code 1 when there are outdated packages
		const err = error as { stdout?: string };
		if (err.stdout) {
			const outdated: Record<string, NpmOutdatedEntry> = JSON.parse(err.stdout || "{}");
			return Object.entries(outdated).map(([name, info]) => ({
				name,
				current: info.current ?? "unknown",
				wanted: info.wanted ?? info.current ?? "unknown",
				latest: info.latest ?? info.current ?? "unknown",
				type: classifySemverChange(info.current ?? "0.0.0", info.latest ?? "0.0.0"),
				depType: getDepType(name, pkg),
				group: getGroup(name),
			}));
		}
		return [];
	}
}

interface PnpmOutdatedEntry {
	current?: string;
	wanted?: string;
	latest?: string;
}

function getOutdatedPnpm(projectPath: string): OutdatedDep[] {
	const pkgPath = join(projectPath, "package.json");
	const pkg: PackageJson = JSON.parse(readFileSync(pkgPath, "utf-8"));

	try {
		const output = execSync("pnpm outdated --format json", {
			cwd: projectPath,
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		});

		const outdated: Record<string, PnpmOutdatedEntry> = JSON.parse(output || "{}");
		return Object.entries(outdated).map(([name, info]) => ({
			name,
			current: info.current ?? "unknown",
			wanted: info.wanted ?? info.current ?? "unknown",
			latest: info.latest ?? info.current ?? "unknown",
			type: classifySemverChange(info.current ?? "0.0.0", info.latest ?? "0.0.0"),
			depType: getDepType(name, pkg),
			group: getGroup(name),
		}));
	} catch (error) {
		const err = error as { stdout?: string };
		if (err.stdout) {
			const outdated: Record<string, PnpmOutdatedEntry> = JSON.parse(err.stdout || "{}");
			return Object.entries(outdated).map(([name, info]) => ({
				name,
				current: info.current ?? "unknown",
				wanted: info.wanted ?? info.current ?? "unknown",
				latest: info.latest ?? info.current ?? "unknown",
				type: classifySemverChange(info.current ?? "0.0.0", info.latest ?? "0.0.0"),
				depType: getDepType(name, pkg),
				group: getGroup(name),
			}));
		}
		return [];
	}
}

interface YarnOutdatedData {
	body?: [string, string, string, string, string, string][];
}

function getOutdatedYarn(projectPath: string): OutdatedDep[] {
	const pkgPath = join(projectPath, "package.json");
	const pkg: PackageJson = JSON.parse(readFileSync(pkgPath, "utf-8"));

	try {
		const output = execSync("yarn outdated --json", {
			cwd: projectPath,
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		});

		// Yarn outputs multiple JSON lines, find the table data
		const lines = output.split("\n").filter(Boolean);
		for (const line of lines) {
			try {
				const parsed: YarnOutdatedData = JSON.parse(line);
				if (parsed.body) {
					return parsed.body.map((row) => {
						const [name = "", current = "", wanted = "", latest = ""] = row;
						return {
							name,
							current,
							wanted,
							latest,
							type: classifySemverChange(current, latest),
							depType: getDepType(name, pkg),
							group: getGroup(name),
						};
					});
				}
			} catch {}
		}
		return [];
	} catch (error) {
		const err = error as { stdout?: string };
		if (err.stdout) {
			const lines = err.stdout.split("\n").filter(Boolean);
			for (const line of lines) {
				try {
					const parsed: YarnOutdatedData = JSON.parse(line);
					if (parsed.body) {
						return parsed.body.map((row) => {
							const [name = "", current = "", wanted = "", latest = ""] = row;
							return {
								name,
								current,
								wanted,
								latest,
								type: classifySemverChange(current, latest),
								depType: getDepType(name, pkg),
								group: getGroup(name),
							};
						});
					}
				} catch {}
			}
		}
		return [];
	}
}

function main(): void {
	const projectPath = process.argv[2] ?? process.cwd();

	if (!existsSync(join(projectPath, "package.json"))) {
		console.error(JSON.stringify({ error: `No package.json found at ${projectPath}` }));
		process.exit(1);
	}

	const pm = detectPackageManager(projectPath);

	let outdated: OutdatedDep[];
	switch (pm) {
		case "pnpm":
			outdated = getOutdatedPnpm(projectPath);
			break;
		case "yarn":
			outdated = getOutdatedYarn(projectPath);
			break;
		default:
			outdated = getOutdatedNpm(projectPath);
	}

	// Sort: major first, then minor, then patch
	const priority = { major: 0, minor: 1, patch: 2 };
	outdated.sort((a, b) => priority[a.type] - priority[b.type]);

	console.log(
		JSON.stringify(
			{
				packageManager: pm,
				projectPath,
				outdated,
				summary: {
					total: outdated.length,
					major: outdated.filter((d) => d.type === "major").length,
					minor: outdated.filter((d) => d.type === "minor").length,
					patch: outdated.filter((d) => d.type === "patch").length,
				},
			},
			null,
			2
		)
	);
}

main();
