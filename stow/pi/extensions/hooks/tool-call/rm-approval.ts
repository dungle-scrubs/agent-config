/**
 * rm Approval Gate — Requires manual confirmation for destructive rm commands.
 *
 * Shows an inline confirmation dialog in the pi TUI when the agent tries to
 * run rm with recursive/force flags. Safe build artifact directories
 * (node_modules, .next, dist, etc.) are auto-approved.
 *
 * This runs as a pi tool_call handler (not the bash hook script) because
 * bash hooks can't show UI dialogs.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { isToolCallEventType } from "@mariozechner/pi-coding-agent";

/** Build artifacts and caches that are safe to delete without confirmation. */
const SAFE_DIRECTORIES = new Set([
	".next",
	".nuxt",
	".cache",
	".parcel-cache",
	".turbo",
	"node_modules",
	"dist",
	"build",
	"out",
	"__pycache__",
	".pytest_cache",
	".mypy_cache",
	".ruff_cache",
	"target",
	".gradle",
	".venv",
	"venv",
	".tox",
	".expo",
]);

/** Pattern matching any rm with recursive + force flags. */
const RM_DANGEROUS_PATTERN =
	/\brm\s+.*(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r|--recursive\s+--force|--force\s+--recursive|-r\s+.*-f|-f\s+.*-r)/i;

/**
 * Extracts target paths from an rm command string.
 * @param command - The full bash command
 * @returns Array of target path strings
 */
function extractRmTargets(command: string): string[] {
	// Rough extraction — split on whitespace, skip rm and flags
	const parts = command.split(/\s+/);
	const targets: string[] = [];
	let foundRm = false;

	for (const part of parts) {
		if (!foundRm) {
			if (part === "rm") foundRm = true;
			continue;
		}
		if (part.startsWith("-")) continue;
		targets.push(part);
	}

	return targets;
}

/**
 * Checks if all rm targets are safe build artifact directories.
 * @param targets - Array of target paths
 * @returns True if every target is in the safe list
 */
function allTargetsSafe(targets: string[]): boolean {
	if (targets.length === 0) return false;
	return targets.every((t) => {
		const base = t.replace(/\/+$/, "").split("/").pop() || "";
		return SAFE_DIRECTORIES.has(base);
	});
}

/**
 * Registers an inline confirmation dialog for destructive rm commands.
 * @param pi - Extension API for registering event handlers
 */
export default function rmApproval(pi: ExtensionAPI): void {
	pi.on("tool_call", async (event, ctx) => {
		if (!isToolCallEventType("bash", event)) return;

		const command = event.input.command;

		// Only intercept rm with recursive+force
		if (!RM_DANGEROUS_PATTERN.test(command)) return;

		// Auto-approve safe directories
		const targets = extractRmTargets(command);
		if (allTargetsSafe(targets)) return;

		// Need UI for confirmation
		if (!ctx.hasUI) {
			return { block: true, reason: "Destructive rm blocked (no UI for confirmation)" };
		}

		const ok = await ctx.ui.confirm(
			"⚠️ Destructive rm",
			`Allow this command?\n\n  ${command}\n\nTargets: ${targets.join(", ") || "(unknown)"}`
		);

		if (!ok) {
			return { block: true, reason: "Destructive rm blocked by user" };
		}

		// User approved — allow through
		return undefined;
	});
}
