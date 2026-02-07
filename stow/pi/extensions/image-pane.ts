/**
 * Image Pane — Display images in a WezTerm side pane.
 *
 * Opens a 30% left-side split pane showing the image via `wezterm imgcat`.
 * The pane auto-closes when dismissed. Subsequent calls reuse or replace
 * the existing image pane.
 *
 * Keyboard shortcut: Ctrl+I (registered in pi)
 * Tool: `show_image` (callable by LLM)
 *
 * Requires: WezTerm with `wezterm cli` available (unix domain or local mux).
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

/** Tracks the currently open image pane so we can reuse or kill it. */
let activePaneId: number | null = null;

/**
 * Kill the active image pane if it exists.
 * @param pi - Extension API for exec
 */
async function killActivePane(pi: ExtensionAPI): Promise<void> {
	if (activePaneId === null) return;
	try {
		await pi.exec("wezterm", ["cli", "kill-pane", "--pane-id", String(activePaneId)]);
	} catch {
		// Pane may already be closed — ignore
	}
	activePaneId = null;
}

/**
 * Open or replace the image pane with a new image.
 * @param pi - Extension API for exec
 * @param imagePath - Absolute path to the image file
 * @returns Error message if failed, undefined on success
 */
async function showImage(pi: ExtensionAPI, imagePath: string): Promise<string | undefined> {
	if (!existsSync(imagePath)) {
		return `File not found: ${imagePath}`;
	}

	// Kill existing pane before opening a new one
	await killActivePane(pi);

	// Split a 30% left pane that displays the image then waits for input to close.
	// `read -n1` keeps the pane open until any key is pressed, then it closes.
	// `clear` + imgcat ensures the image fills the pane cleanly.
	const shellCmd = `clear && wezterm imgcat ${shellEscape(imagePath)} && echo "" && echo "Press any key to close" && read -n1 -s`;

	const result = await pi.exec("wezterm", [
		"cli",
		"split-pane",
		"--left",
		"--percent",
		"30",
		"--",
		"bash",
		"-c",
		shellCmd,
	]);

	if (result.code !== 0) {
		return `Failed to open image pane: ${result.stderr}`;
	}

	const paneIdStr = result.stdout.trim();
	const paneId = Number.parseInt(paneIdStr, 10);
	if (Number.isNaN(paneId)) {
		return `Unexpected pane-id from wezterm: ${paneIdStr}`;
	}

	activePaneId = paneId;
	return undefined;
}

/**
 * Escape a string for safe use in a bash command.
 * @param s - Raw string to escape
 * @returns Shell-safe escaped string
 */
function shellEscape(s: string): string {
	return `'${s.replace(/'/g, "'\\''")}'`;
}

/**
 * Registers the image pane shortcut and tool.
 * @param pi - Extension API
 */
export default function imagePane(pi: ExtensionAPI): void {
	// --- Keyboard shortcut: Ctrl+Shift+I to pick and display an image ---
	pi.registerShortcut("ctrl+shift+i", {
		description: "Show image in side pane",
		handler: async (ctx: ExtensionContext) => {
			if (!ctx.hasUI) return;

			const imagePath = await ctx.ui.input("Image path:", "/path/to/image.png");
			if (!imagePath) return;

			const resolved = resolve(imagePath);
			const error = await showImage(pi, resolved);
			if (error) {
				ctx.ui.notify(error, "error");
			}
		},
	});

	// --- Tool: show_image (LLM-callable) ---
	pi.registerTool({
		name: "show_image",
		label: "Show Image",
		description:
			"Display an image file in a WezTerm side pane (30% left split). " +
			"Use when the user asks to view, preview, or display an image file. " +
			"Supports JPEG, PNG, GIF, WebP, and other formats WezTerm can render.",
		parameters: Type.Object({
			path: Type.String({ description: "Absolute or relative path to the image file" }),
			close: Type.Optional(Type.Boolean({ description: "If true, close the image pane instead of showing an image" })),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (params.close) {
				await killActivePane(pi);
				return {
					content: [{ type: "text", text: "Image pane closed." }],
					details: { closed: true },
				};
			}

			const resolved = resolve(ctx.cwd, params.path.replace(/^@/, ""));
			const error = await showImage(pi, resolved);

			if (error) {
				return {
					content: [{ type: "text", text: error }],
					details: { error },
					isError: true,
				};
			}

			return {
				content: [{ type: "text", text: `Showing image: ${resolved} (pane ${activePaneId})` }],
				details: { path: resolved, paneId: activePaneId },
			};
		},
	});

	// --- Cleanup on session shutdown ---
	pi.on("session_shutdown", async () => {
		await killActivePane(pi);
	});
}
