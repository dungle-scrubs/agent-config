/**
 * Docs Gate — Post-fetch safety net for documentation URLs.
 *
 * The LLM is instructed via system prompt (context.md) to always use the docs
 * tool instead of web-fetch for documentation. This module provides a safety net:
 *
 * - tool_result on web-fetch: Appends a reminder to save the fetched content
 *   via docs:add_doc if it hasn't been cached yet. The LLM sees this reminder
 *   in context and learns to use docs tools next time.
 *
 * No pattern matching, no classification. The LLM already knows what it fetched.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";

const DOCS_DIR = path.join(process.env.HOME || "~", ".ai-docs");
const LIST_FILE = path.join(DOCS_DIR, "_list.md");

// === Docs Cache Lookup ===

/** A documentation entry tracked in the local cache list. */
interface CachedDoc {
	name: string;
	url: string;
	file: string;
}

/**
 * Parses ~/.ai-docs/_list.md for cached documentation entries.
 * @returns Array of cached doc records
 */
function parseCachedDocs(): CachedDoc[] {
	try {
		if (!fs.existsSync(LIST_FILE)) return [];
		const content = fs.readFileSync(LIST_FILE, "utf-8");
		const docs: CachedDoc[] = [];
		const pattern = /\|\s*([^|]+?)\s*\|\s*(https?:\/\/[^|]+?)\s*\|\s*([^|]+?)\s*\|/g;
		let match: RegExpExecArray | null;
		while ((match = pattern.exec(content)) !== null) {
			const [, name, url, file] = match;
			if (name.trim() !== "Doc") {
				docs.push({ name: name.trim(), url: url.trim(), file: file.trim() });
			}
		}
		return docs;
	} catch {
		return [];
	}
}

/**
 * Checks if a URL is already tracked in the docs cache.
 * Matches on host — if any doc from the same host is cached, it's tracked.
 * @param url - URL to look up
 * @returns True if the URL's host is already tracked
 */
function isUrlTracked(url: string): boolean {
	const docs = parseCachedDocs();
	if (docs.length === 0) return false;

	try {
		const hostname = new URL(url).hostname.replace(/^www\./, "");
		for (const doc of docs) {
			try {
				const docHost = new URL(doc.url).hostname.replace(/^www\./, "");
				if (hostname === docHost) return true;
			} catch {
				continue;
			}
		}
	} catch {
		// Invalid URL
	}

	return false;
}

/**
 * Extracts a human-readable doc name from a URL.
 * @param url - URL to extract name from
 * @returns Extracted name
 */
function docNameFromUrl(url: string): string {
	try {
		const parsed = new URL(url);
		const hostname = parsed.hostname.replace(/^www\./, "").replace(/^docs\./, "");
		const parts = hostname.split(".");
		return parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
	} catch {
		return "Unknown";
	}
}

// === Extension Registration ===

/**
 * Registers a tool_result handler that appends a reminder to save documentation
 * fetched via web-fetch. Acts as a safety net when the LLM ignores system prompt
 * instructions to use the docs tool instead.
 * @param pi - Extension API for registering event handlers
 */
export default function docsGate(pi: ExtensionAPI): void {
	pi.on("tool_result", async (event, _ctx) => {
		if (event.toolName !== "web-fetch") return;
		if (event.isError) return;

		const input = event.input as { url?: string };
		const url = input?.url;
		if (!url) return;

		// Already tracked — no reminder needed
		if (isUrlTracked(url)) return;

		const textContent = event.content.find(
			(c): c is { type: "text"; text: string } => c.type === "text",
		);
		if (!textContent) return;

		const name = docNameFromUrl(url);
		const reminder =
			`\n\n---\n` +
			`**Save this documentation locally** so it's cached for future use:\n` +
			`execute_tool(app: "docs", tool: "add_doc", args: { name: "${name}", url: "${url}" })\n` +
			`Next time, use docs:search_docs or docs:get_doc instead of web-fetch.`;

		return {
			content: [{ type: "text", text: textContent.text + reminder }],
			details: event.details,
			isError: false,
		};
	});
}
