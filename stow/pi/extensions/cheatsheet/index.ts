/**
 * Cheatsheet Extension - Prints keyboard shortcuts to terminal
 *
 * Usage: /keys or /cheatsheet or Ctrl+?
 * Just prints and scrolls away naturally
 */

import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Key, visibleWidth } from "@mariozechner/pi-tui";

interface Shortcut {
	key: string;
	description: string;
}

interface Section {
	title: string;
	shortcuts: Shortcut[];
}

// Shortcuts organized by section
const SECTIONS: Section[] = [
	{
		title: "Global",
		shortcuts: [
			{ key: "Ctrl+C", description: "Cancel operation" },
			{ key: "Ctrl+D", description: "Exit pi" },
			{ key: "Ctrl+L", description: "Clear screen" },
		],
	},
	{
		title: "Input",
		shortcuts: [
			{ key: "Enter", description: "Submit" },
			{ key: "Shift+Enter", description: "Newline" },
			{ key: "↑ / ↓", description: "History" },
			{ key: "Tab", description: "Autocomplete" },
			{ key: "Ctrl+U", description: "Clear line" },
		],
	},
	{
		title: "Execution",
		shortcuts: [{ key: "Escape", description: "Abort tool" }],
	},
	{
		title: "Shortcuts",
		shortcuts: [
			{ key: "Ctrl+Shift+B", description: "Background tasks" },
			{ key: "Ctrl+Shift+T", description: "Toggle tasks" },
			{ key: "Ctrl+?", description: "This cheatsheet" },
		],
	},
	{
		title: "Viewers",
		shortcuts: [
			{ key: "Esc / q", description: "Close" },
			{ key: "↑ ↓", description: "Scroll" },
			{ key: "g / G", description: "Top / bottom" },
			{ key: "Enter", description: "Select" },
		],
	},
];

const MIN_TWO_COL_WIDTH = 70;

function padRight(str: string, len: number): string {
	const vis = visibleWidth(str);
	return str + " ".repeat(Math.max(0, len - vis));
}

function buildCheatsheet(theme: any, width: number): string {
	const useTwoCol = width >= MIN_TWO_COL_WIDTH;
	const lines: string[] = [];

	lines.push("");
	lines.push(theme.fg("accent", "⌨ Keyboard Shortcuts"));
	lines.push("");

	if (useTwoCol) {
		// Calculate total items to split evenly
		const allItems: { section: string; key: string; desc: string }[] = [];
		for (const section of SECTIONS) {
			allItems.push({ section: section.title, key: "", desc: "" }); // section header
			for (const s of section.shortcuts) {
				allItems.push({ section: "", key: s.key, desc: s.description });
			}
			allItems.push({ section: "", key: "", desc: "" }); // spacer
		}

		// Split into two columns
		const mid = Math.ceil(allItems.length / 2);
		const leftItems = allItems.slice(0, mid);
		const rightItems = allItems.slice(mid);

		const colWidth = Math.floor((width - 4) / 2);
		const keyWidth = 14;

		const formatItem = (item: { section: string; key: string; desc: string }): string => {
			if (item.section) return theme.fg("muted", item.section);
			if (item.key) return `  ${theme.fg("success", padRight(item.key, keyWidth))}${item.desc}`;
			return "";
		};

		const maxRows = Math.max(leftItems.length, rightItems.length);
		for (let i = 0; i < maxRows; i++) {
			const left = leftItems[i] ? formatItem(leftItems[i]) : "";
			const right = rightItems[i] ? formatItem(rightItems[i]) : "";
			const sep = theme.fg("muted", "│");
			lines.push(`${padRight(left, colWidth)} ${sep} ${right}`);
		}
	} else {
		// Single column
		const keyWidth = 14;
		for (const section of SECTIONS) {
			lines.push(theme.fg("muted", section.title));
			for (const s of section.shortcuts) {
				lines.push(`  ${theme.fg("success", padRight(s.key, keyWidth))}${s.description}`);
			}
			lines.push("");
		}
	}

	lines.push("");
	return lines.join("\n");
}

function showCheatsheet(ctx: ExtensionContext): void {
	const cols = process.stdout.columns || 100;
	const content = buildCheatsheet(ctx.ui.theme, cols);
	// Write directly to terminal
	process.stdout.write(content);
}

export default function cheatsheetExtension(pi: ExtensionAPI): void {
	pi.registerCommand("keys", {
		description: "Show keyboard shortcuts",
		handler: async (_args, ctx) => {
			showCheatsheet(ctx);
		},
	});

	pi.registerCommand("cheatsheet", {
		description: "Show keyboard shortcuts (alias for /keys)",
		handler: async (_args, ctx) => {
			showCheatsheet(ctx);
		},
	});

	pi.registerShortcut(Key.ctrl("?"), {
		description: "Show keyboard shortcuts",
		handler: async (ctx) => {
			showCheatsheet(ctx);
		},
	});
}
