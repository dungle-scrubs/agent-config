/**
 * Custom Footer Extension
 *
 * Renders a footer with:
 * - Left side: model info, token stats
 * - Right side: git branch, extension statuses (tp:ok, etc.)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { visibleWidth } from "@mariozechner/pi-tui";

export default function customFooterExtension(pi: ExtensionAPI): void {
	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.setFooter((tui, theme, footerData) => {
			let disposeHandler: (() => void) | undefined;

			return {
				render(width: number): string[] {
					// Left side: model name
					const model = ctx.model;
					const modelName = model?.name || model?.id || "no model";
					const left = theme.fg("muted", modelName);

					// Right side: git branch + extension statuses
					const branch = footerData.getGitBranch();
					const statuses = footerData.getExtensionStatuses();

					const rightParts: string[] = [];

					// Add extension statuses (like tp:ok)
					for (const [_id, status] of statuses) {
						if (status) rightParts.push(status);
					}

					// Add git branch
					if (branch) {
						rightParts.push(theme.fg("accent", branch));
					}

					const right = rightParts.join(" ");

					// Calculate padding to right-align
					const leftWidth = visibleWidth(left);
					const rightWidth = visibleWidth(right);
					const padding = Math.max(1, width - leftWidth - rightWidth);

					return [left + " ".repeat(padding) + right];
				},

				invalidate(): void {
					// No caching
				},

				dispose: (() => {
					// Subscribe to branch changes for reactive updates
					disposeHandler = footerData.onBranchChange(() => tui.requestRender());
					return disposeHandler;
				})(),
			};
		});
	});
}
