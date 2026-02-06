/**
 * Shared global state types for cross-extension communication.
 *
 * Extensions expose state via globalThis for other extensions to read.
 * This file provides type-safe access instead of `globalThis as any`.
 */

type GlobalMap = Map<string, Record<string, unknown>>;

/** Extension globals registered on globalThis */
interface PiGlobals {
	__piBackgroundTasks?: GlobalMap;
	__piRunningSubagents?: GlobalMap;
	__piBackgroundSubagents?: GlobalMap;
	__piGitStatusInterval?: ReturnType<typeof setInterval> | null;
	__piTasksInterval?: ReturnType<typeof setInterval> | null;
	__piSubagentWidgetInterval?: ReturnType<typeof setInterval> | null;
	__piToolProxyStatusInterval?: ReturnType<typeof setInterval> | null;
}

// Augment globalThis — var is required for this pattern
declare namespace globalThis {
	var __piBackgroundTasks: PiGlobals["__piBackgroundTasks"];
	var __piRunningSubagents: PiGlobals["__piRunningSubagents"];
	var __piBackgroundSubagents: PiGlobals["__piBackgroundSubagents"];
	var __piGitStatusInterval: PiGlobals["__piGitStatusInterval"];
	var __piTasksInterval: PiGlobals["__piTasksInterval"];
	var __piSubagentWidgetInterval: PiGlobals["__piSubagentWidgetInterval"];
	var __piToolProxyStatusInterval: PiGlobals["__piToolProxyStatusInterval"];
}
