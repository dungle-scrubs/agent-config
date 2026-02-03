/**
 * Custom Responsive Footer Extension
 *
 * Wide layout (2 lines):
 *   ~/dev/project                                                  main*
 *   ↑1.2k ↓39k R12M W708k $11.444 (sub) 68.4%/200k (auto) tp:ok   model • high
 *
 * Narrow layout (4 lines):
 *   ~/dev/project
 *    main*
 *   ↑1.2k ↓39k R12M W708k $11.444 (sub) 68.4%/200k (auto) tp:ok
 *   model • high
 */

import { execSync } from "node:child_process";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

interface GitState {
	branch: string | null;
	dirty: boolean;
	ahead: number;
	behind: number;
}

/**
 * Runs a git command and returns output or null on error.
 * @param cmd - Git command to run (without 'git' prefix)
 * @returns Trimmed stdout output, or null if command failed
 */
function runGit(cmd: string): string | null {
	try {
		return execSync(`git ${cmd}`, {
			encoding: "utf-8",
			timeout: 2000,
			stdio: ["pipe", "pipe", "pipe"],
		}).trim();
	} catch {
		return null;
	}
}

/**
 * Checks if current directory is a git worktree.
 * @returns True if in a git worktree, false otherwise
 */
function isGitWorktree(): boolean {
	const gitDir = runGit("rev-parse --git-dir");
	if (!gitDir) return false;
	// In a worktree, git-dir contains "worktrees" path segment
	return gitDir.includes("/worktrees/");
}

/**
 * Gets git state including branch, dirty status, and ahead/behind counts.
 * @returns Git state object or null if not in a git repo
 */
function getGitState(): GitState | null {
	const gitDir = runGit("rev-parse --git-dir");
	if (!gitDir) return null;

	let branch = runGit("branch --show-current");
	if (!branch) {
		branch = runGit("rev-parse --short HEAD");
		if (branch) branch = `(${branch})`;
	}
	if (!branch) return null;

	const status = runGit("status --porcelain");
	const dirty = status !== null && status.length > 0;

	let ahead = 0;
	let behind = 0;
	const upstream = runGit("rev-parse --abbrev-ref @{upstream}");
	if (upstream) {
		const aheadBehind = runGit("rev-list --left-right --count HEAD...@{upstream}");
		if (aheadBehind) {
			const [a, b] = aheadBehind.split(/\s+/).map(Number);
			ahead = a || 0;
			behind = b || 0;
		}
	}

	return { branch, dirty, ahead, behind };
}

// Minimum width for side-by-side layout
const MIN_WIDE_WIDTH = 100;

/**
 * Formats token counts with k/M suffixes for readability.
 * @param count - Token count to format
 * @returns Formatted string (e.g., "1.2k", "5M")
 */
function formatTokens(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
	return `${Math.round(count / 1000000)}M`;
}

/**
 * Sanitizes text for single-line display by collapsing whitespace.
 * @param text - Text to sanitize
 * @returns Cleaned single-line string
 */
function sanitize(text: string): string {
	return text.replace(/[\r\n\t]/g, " ").replace(/ +/g, " ").trim();
}

/**
 * Aligns left and right content with padding between.
 * @param left - Left-aligned content
 * @param right - Right-aligned content
 * @param width - Total width to fill
 * @returns Padded string with left and right content
 */
function alignLeftRight(left: string, right: string, width: number): string {
	const leftWidth = visibleWidth(left);
	const rightWidth = visibleWidth(right);
	const padding = Math.max(1, width - leftWidth - rightWidth);
	return left + " ".repeat(padding) + right;
}

/**
 * Registers a custom responsive footer showing git, tokens, and model info.
 * @param pi - Extension API for registering event handlers
 */
export default function customFooterExtension(pi: ExtensionAPI): void {
	let extensionCtx: ExtensionContext | null = null;
	let autoCompactEnabled = true;

	pi.on("session_start", async (_event, ctx) => {
		extensionCtx = ctx;

		ctx.ui.setFooter((tui, theme, footerData) => {
			let disposeHandler: (() => void) | undefined;

			return {
				render(width: number): string[] {
					if (!extensionCtx) return [theme.fg("dim", "loading...")];

					const sessionManager = extensionCtx.sessionManager;
					const model = extensionCtx.model;

					// Calculate cumulative usage from session
					let totalInput = 0;
					let totalOutput = 0;
					let totalCacheRead = 0;
					let totalCacheWrite = 0;
					let totalCost = 0;

					for (const entry of sessionManager.getEntries()) {
						if (entry.type === "message" && entry.message.role === "assistant") {
							const usage = entry.message.usage;
							totalInput += usage.input;
							totalOutput += usage.output;
							totalCacheRead += usage.cacheRead;
							totalCacheWrite += usage.cacheWrite;
							totalCost += usage.cost.total;
						}
					}

					// Get context percentage from last assistant message
					const branch = sessionManager.getBranch();
					const lastAssistant = branch
						.slice()
						.reverse()
						.find(
							(e) =>
								e.type === "message" &&
								e.message.role === "assistant" &&
								(e.message as any).stopReason !== "aborted"
						);

					let contextTokens = 0;
					if (lastAssistant?.type === "message" && lastAssistant.message.role === "assistant") {
						const u = lastAssistant.message.usage;
						contextTokens = u.input + u.output + u.cacheRead + u.cacheWrite;
					}

					const contextWindow = model?.contextWindow || 0;
					const contextPercentValue = contextWindow > 0 ? (contextTokens / contextWindow) * 100 : 0;

					// Build path (replace home with ~)
					let pwd = process.cwd();
					const home = process.env.HOME || process.env.USERPROFILE;
					if (home && pwd.startsWith(home)) {
						pwd = `~${pwd.slice(home.length)}`;
					}

					// Git branch with status symbols
					const gitState = getGitState();
					let gitBranch = "";
					if (gitState?.branch) {
						const parts: string[] = [];
						// Worktree badge (teal bg, dark text) - to the left of branch
						if (isGitWorktree()) {
							parts.push(`\x1b[48;2;94;234;212m\x1b[38;2;19;78;74m worktree \x1b[0m`);
						}
						// Branch icon and name (teal)
						parts.push(`\x1b[38;2;139;213;202m ${gitState.branch}\x1b[0m`);
						// Dirty indicator
						if (gitState.dirty) parts.push(theme.fg("warning", "*"));
						// Ahead/behind
						if (gitState.ahead > 0) parts.push(theme.fg("success", `↑${gitState.ahead}`));
						if (gitState.behind > 0) parts.push(theme.fg("error", `↓${gitState.behind}`));
						gitBranch = parts.join("");
					}

					// Build stats
					const statsParts: string[] = [];
					if (totalInput) statsParts.push(`↑${formatTokens(totalInput)}`);
					if (totalOutput) statsParts.push(`↓${formatTokens(totalOutput)}`);
					if (totalCacheRead) statsParts.push(`R${formatTokens(totalCacheRead)}`);
					if (totalCacheWrite) statsParts.push(`W${formatTokens(totalCacheWrite)}`);
					if (totalCost) statsParts.push(`$${totalCost.toFixed(3)}`);

					// Context percentage with color
					const autoIndicator = autoCompactEnabled ? " (auto)" : "";
					const contextDisplay = `${contextPercentValue.toFixed(1)}%/${formatTokens(contextWindow)}${autoIndicator}`;
					let contextStr: string;
					if (contextPercentValue > 90) {
						contextStr = theme.fg("error", contextDisplay);
					} else if (contextPercentValue > 70) {
						contextStr = theme.fg("warning", contextDisplay);
					} else {
						contextStr = contextDisplay;
					}
					statsParts.push(contextStr);

					// Extension statuses (like tp:ok) - exclude git status since it's in top right
					const extensionStatuses = footerData.getExtensionStatuses();
					const statusParts: string[] = [];
					for (const [key, status] of extensionStatuses) {
						if (status && key !== "git") statusParts.push(sanitize(status));
					}
					const statusStr = statusParts.join(" ");

					// Stats + statuses combined
					const statsAndStatus = statsParts.join(" ") + (statusStr ? ` ${statusStr}` : "");

					// Model + thinking level
					const modelName = model?.id || "no-model";
					let modelStr = modelName;
					if (model?.reasoning) {
						const thinkingLevel = (extensionCtx as any).thinkingLevel || pi.getThinkingLevel() || "off";
						modelStr = thinkingLevel === "off" ? `${modelName} • thinking off` : `${modelName} • ${thinkingLevel}`;
					}

					// Responsive layout
					const useWide = width >= MIN_WIDE_WIDTH;

					if (useWide) {
						// 2-line layout
						const line1 = alignLeftRight(
							theme.fg("dim", truncateToWidth(pwd, width - gitBranch.length - 2, "...")),
							theme.fg("accent", gitBranch),
							width
						);
						const line2 = alignLeftRight(
							theme.fg("dim", truncateToWidth(statsAndStatus, width - modelStr.length - 2, "...")),
							theme.fg("dim", modelStr),
							width
						);
						return [line1, line2];
					} else {
						// 4-line stacked layout
						return [
							theme.fg("dim", truncateToWidth(pwd, width, "...")),
							theme.fg("accent", gitBranch || "(no branch)"),
							theme.fg("dim", truncateToWidth(statsAndStatus, width, "...")),
							theme.fg("dim", truncateToWidth(modelStr, width, "...")),
						];
					}
				},

				invalidate(): void {
					// No caching
				},

				dispose: (() => {
					disposeHandler = footerData.onBranchChange(() => tui.requestRender());
					return disposeHandler;
				})(),
			};
		});
	});
}
