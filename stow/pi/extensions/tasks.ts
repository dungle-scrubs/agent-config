/**
 * Tasks Extension for Pi
 *
 * Claude Code-style task management with:
 * - Three states: pending (☐), in-progress (◉), completed (☑)
 * - Dependency tracking between tasks
 * - Persistence across compactions
 * - Status widget with dynamic sizing
 * - Ctrl+T to toggle visibility
 * - /tasks command to view/manage
 * - /todos command for compatibility
 *
 * NOTE: This extension only runs in the main Pi process, not in subagent workers.
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { AssistantMessage, TextContent } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Key, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";

// Minimum width for side-by-side layout (tasks left, subagents right)
const MIN_SIDE_BY_SIDE_WIDTH = 120;

/** Lifecycle state of a task. */
type TaskStatus = "pending" | "in_progress" | "completed";

/** A single task with status, dependencies, and timestamps. */
interface Task {
	id: string;
	title: string;
	status: TaskStatus;
	dependencies: string[]; // IDs of tasks this depends on
	createdAt: number;
	completedAt?: number;
}

/** Complete tasks widget state including visibility and active task tracking. */
interface TasksState {
	tasks: Task[];
	visible: boolean;
	activeTaskId: string | null;
}

/**
 * Type guard to check if a message is an assistant message.
 * @param m - Message to check
 * @returns True if message is from assistant
 */
function isAssistantMessage(m: AgentMessage): m is AssistantMessage {
	return m.role === "assistant" && Array.isArray(m.content);
}

/**
 * Extracts all text content from an assistant message.
 * @param message - Assistant message to extract from
 * @returns Concatenated text content
 */
function getTextContent(message: AssistantMessage): string {
	return message.content
		.filter((block): block is TextContent => block.type === "text")
		.map((block) => block.text)
		.join("\n");
}

/**
 * Generates a unique task ID using timestamp and random string.
 * @returns Unique task identifier
 */
function generateTaskId(): string {
	return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Extract tasks from text (numbered lists, checkboxes, etc.)
/**
 * Extract task titles from markdown-style task list text.
 * @param text - Text containing task list items
 * @returns Array of task title strings
 */
function _extractTasksFromText(text: string): string[] {
	const tasks: string[] = [];

	// Match numbered lists: "1. task", "1) task"
	const numberedRegex = /^\s*(\d+)[.)]\s+(.+)$/gm;
	let match;
	while ((match = numberedRegex.exec(text)) !== null) {
		const task = match[2].trim();
		if (task && !task.startsWith("[") && task.length > 3) {
			tasks.push(task);
		}
	}

	// Match checkbox lists: "- [ ] task", "- [x] task", "* [ ] task"
	const checkboxRegex = /^\s*[-*]\s*\[[ x]\]\s+(.+)$/gim;
	while ((match = checkboxRegex.exec(text)) !== null) {
		const task = match[1].trim();
		if (task && task.length > 3) {
			tasks.push(task);
		}
	}

	// Match "Task:" or "TODO:" headers followed by items
	const taskHeaderRegex = /(?:Tasks?|TODO|To-?do|Steps?):\s*\n((?:\s*[-*\d.]+.+\n?)+)/gi;
	while ((match = taskHeaderRegex.exec(text)) !== null) {
		const block = match[1];
		const items = block.split("\n").filter((line) => line.trim());
		for (const item of items) {
			const cleaned = item.replace(/^\s*[-*\d.)]+\s*/, "").trim();
			if (cleaned && cleaned.length > 3) {
				tasks.push(cleaned);
			}
		}
	}

	return [...new Set(tasks)]; // Dedupe
}

/**
 * Finds tasks marked as completed in the given text.
 * @param text - Text to search for completion markers
 * @param tasks - Tasks to check for completion
 * @returns Array of completed task IDs
 */
function findCompletedTasks(text: string, tasks: Task[]): string[] {
	const completed: string[] = [];

	for (const task of tasks) {
		// Check for explicit completion markers
		const patterns = [
			new RegExp(`\\[DONE:?\\s*${task.id}\\]`, "i"),
			new RegExp(`\\[COMPLETE:?\\s*${task.id}\\]`, "i"),
			new RegExp(`✓\\s*${escapeRegex(task.title.substring(0, 30))}`, "i"),
			new RegExp(`completed:?\\s*${escapeRegex(task.title.substring(0, 30))}`, "i"),
			new RegExp(`done:?\\s*${escapeRegex(task.title.substring(0, 30))}`, "i"),
			new RegExp(`\\[x\\]\\s*${escapeRegex(task.title.substring(0, 30))}`, "i"),
		];

		for (const pattern of patterns) {
			if (pattern.test(text)) {
				completed.push(task.id);
				break;
			}
		}
	}

	return completed;
}

/**
 * Escapes special regex characters in a string.
 * @param str - String to escape
 * @returns Escaped string safe for use in regex
 */
function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Registers task management tools, commands, and widget.
 * @param pi - Extension API for registering tools, commands, and event handlers
 */
export default function tasksExtension(pi: ExtensionAPI): void {
	// Skip in subagent workers - they don't need task management UI
	if (process.env.PI_IS_SUBAGENT === "1") {
		return;
	}
	const state: TasksState = {
		tasks: [],
		visible: true,
		activeTaskId: null,
	};

	// Render the task widget
	let lastWidgetContent = "";

	// Spinner frames for animation
	const SPINNER_FRAMES = ["◐", "◓", "◑", "◒"];
	let spinnerFrame = 0;

	/**
	 * Render task list lines (left column in side-by-side mode)
	 */
	function renderTaskLines(ctx: ExtensionContext, maxTitleLen: number): string[] {
		if (state.tasks.length === 0) return [];

		const lines: string[] = [];
		const completed = state.tasks.filter((t) => t.status === "completed").length;
		const maxVisible = Math.min(10, state.tasks.length);
		const visibleTasks = state.tasks.slice(0, maxVisible);

		lines.push(ctx.ui.theme.fg("accent", `Tasks (${completed}/${state.tasks.length})`));

		for (let i = 0; i < visibleTasks.length; i++) {
			const task = visibleTasks[i];
			const isLast = i === visibleTasks.length - 1 && state.tasks.length <= maxVisible;
			const treeChar = isLast ? "└─" : "├─";
			let icon: string;
			let textStyle: (s: string) => string;

			switch (task.status) {
				case "completed":
					icon = ctx.ui.theme.fg("success", "✓");
					textStyle = (s) => ctx.ui.theme.fg("muted", ctx.ui.theme.strikethrough(s));
					break;
				case "in_progress":
					icon = ctx.ui.theme.fg("warning", SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length]);
					textStyle = (s) => ctx.ui.theme.fg("accent", s);
					break;
				default:
					icon = "☐";
					textStyle = (s) => s;
			}

			const title = task.title.length > maxTitleLen ? `${task.title.substring(0, maxTitleLen - 3)}...` : task.title;
			lines.push(`${ctx.ui.theme.fg("muted", treeChar)} ${icon} ${textStyle(title)}`);
		}

		if (state.tasks.length > maxVisible) {
			lines.push(ctx.ui.theme.fg("muted", `└─ ... and ${state.tasks.length - maxVisible} more`));
		}

		return lines;
	}

	/**
	 * Render subagent lines (right column in side-by-side mode, or below tasks in stacked mode)
	 */
	function renderSubagentLines(
		ctx: ExtensionContext,
		spinner: string,
		fgRunning: any[],
		bgRunning: any[],
		maxTaskPreviewLen: number,
		standalone: boolean
	): string[] {
		if (fgRunning.length === 0 && bgRunning.length === 0) return [];

		const lines: string[] = [];

		// Foreground (sync) subagents
		if (fgRunning.length > 0) {
			lines.push(
				`${ctx.ui.theme.fg("accent", "Subagents")} ${ctx.ui.theme.fg("warning", `${spinner} ${fgRunning.length} running`)}`
			);

			for (let i = 0; i < fgRunning.length; i++) {
				const sub = fgRunning[i];
				const isLast = i === fgRunning.length - 1 && bgRunning.length === 0;
				const treeChar = isLast ? "└─" : "├─";
				const ms = Date.now() - sub.startTime;
				const secs = Math.floor(ms / 1000);
				const duration = secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m${secs % 60}s`;
				const taskPreview = sub.task.length > maxTaskPreviewLen ? `${sub.task.slice(0, maxTaskPreviewLen - 3)}...` : sub.task;
				lines.push(
					`${ctx.ui.theme.fg("muted", treeChar)} ${ctx.ui.theme.fg("warning", spinner)} ${ctx.ui.theme.fg("accent", sub.agent)}: ${ctx.ui.theme.fg("dim", taskPreview)} ${ctx.ui.theme.fg("muted", `(${duration})`)}`
				);
			}
		}

		// Background subagents
		if (bgRunning.length > 0) {
			if (fgRunning.length === 0) {
				lines.push(
					`${ctx.ui.theme.fg("accent", "Background Subagents")} ${ctx.ui.theme.fg("success", `${spinner} ${bgRunning.length} running`)}`
				);
			} else {
				lines.push(`${ctx.ui.theme.fg("muted", "├─")} ${ctx.ui.theme.fg("dim", "background:")}`);
			}

			for (let i = 0; i < bgRunning.length; i++) {
				const sub = bgRunning[i];
				const isLast = i === bgRunning.length - 1;
				const treeChar = isLast ? "└─" : "├─";
				const indent = fgRunning.length > 0 ? "│  " : "";
				const ms = Date.now() - sub.startTime;
				const secs = Math.floor(ms / 1000);
				const duration = secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m${secs % 60}s`;
				const taskPreview = sub.task.length > maxTaskPreviewLen ? `${sub.task.slice(0, maxTaskPreviewLen - 3)}...` : sub.task;
				lines.push(
					`${ctx.ui.theme.fg("muted", indent + treeChar)} ${ctx.ui.theme.fg("success", spinner)} ${ctx.ui.theme.fg("accent", sub.agent)}: ${ctx.ui.theme.fg("dim", taskPreview)} ${ctx.ui.theme.fg("muted", `(${duration})`)}`
				);
			}
		}

		return lines;
	}

	/**
	 * Render background bash task lines
	 */
	function renderBgBashLines(ctx: ExtensionContext, maxCmdLen: number): string[] {
		const bgTasksMap = (globalThis as any).__piBackgroundTasks as Map<string, any> | undefined;
		if (!bgTasksMap) return [];

		const running = [...bgTasksMap.values()].filter((t: any) => t.status === "running");
		if (running.length === 0) return [];

		const lines: string[] = [];
		lines.push(ctx.ui.theme.fg("accent", `Background Tasks (${running.length})`));

		for (let i = 0; i < Math.min(running.length, 5); i++) {
			const task = running[i];
			const isLast = i === Math.min(running.length, 5) - 1 && running.length <= 5;
			const treeChar = isLast ? "└─" : "├─";
			const ms = Date.now() - task.startTime;
			const secs = Math.floor(ms / 1000);
			const duration = secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m${secs % 60}s`;
			const cmd = task.command.length > maxCmdLen ? `${task.command.slice(0, maxCmdLen - 3)}...` : task.command;
			lines.push(
				`${ctx.ui.theme.fg("muted", treeChar)} ${ctx.ui.theme.fg("accent", "●")} ${cmd} ${ctx.ui.theme.fg("muted", `(${duration})`)}`
			);
		}

		if (running.length > 5) {
			lines.push(ctx.ui.theme.fg("muted", `└─ ... and ${running.length - 5} more`));
		}

		return lines;
	}

	/**
	 * Pad a line to a specific visible width (accounting for ANSI codes)
	 */
	function padToWidth(line: string, targetWidth: number): string {
		const currentWidth = visibleWidth(line);
		if (currentWidth >= targetWidth) {
			return truncateToWidth(line, targetWidth, "");
		}
		return line + " ".repeat(targetWidth - currentWidth);
	}

	/**
	 * Merge two column arrays into side-by-side lines, with right column bottom-aligned
	 */
	function mergeSideBySide(
		leftLines: string[],
		rightLines: string[],
		leftWidth: number,
		separator: string
	): string[] {
		const maxRows = Math.max(leftLines.length, rightLines.length);
		const result: string[] = [];

		// Bottom-align: pad right column at the top
		const rightPadding = maxRows - rightLines.length;

		for (let i = 0; i < maxRows; i++) {
			const left = leftLines[i] ?? "";
			const rightIndex = i - rightPadding;
			const right = rightIndex >= 0 ? (rightLines[rightIndex] ?? "") : "";
			result.push(padToWidth(left, leftWidth) + separator + right);
		}

		return result;
	}

	function updateWidget(ctx: ExtensionContext): void {
		// Check for foreground (sync) and background subagents
		const fgSubagentsMap = (globalThis as any).__piRunningSubagents as Map<string, any> | undefined;
		const bgSubagentsMap = (globalThis as any).__piBackgroundSubagents as Map<string, any> | undefined;
		const bgTasksMap = (globalThis as any).__piBackgroundTasks as Map<string, any> | undefined;

		const fgRunning = fgSubagentsMap ? [...fgSubagentsMap.values()] : [];
		const bgRunning = bgSubagentsMap ? [...bgSubagentsMap.values()].filter((s: any) => s.status === "running") : [];
		const bgTasks = bgTasksMap ? [...bgTasksMap.values()].filter((t: any) => t.status === "running") : [];

		const hasSubagents = fgRunning.length > 0 || bgRunning.length > 0;
		const hasBgTasks = bgTasks.length > 0;
		const hasRightColumn = hasSubagents || hasBgTasks;
		const hasTasks = state.tasks.length > 0;

		if (!state.visible || (!hasTasks && !hasRightColumn)) {
			if (lastWidgetContent !== "") {
				ctx.ui.setWidget("1-tasks", undefined);
				lastWidgetContent = "";
			}
			return;
		}

		const spinner = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length];

		// Build stable key for structure changes
		const taskStates = state.tasks.map((t) => `${t.id}:${t.status}`).join(",");
		const fgIds = fgRunning.map((s: any) => s.id).join(",");
		const bgIds = bgRunning.map((s: any) => s.id).join(",");
		const bgTaskIds = bgTasks.map((t: any) => t.id).join(",");
		const stableKey = `${taskStates}|${fgIds}|${bgIds}|${bgTaskIds}`;

		// Only update when structure changes or background items running (for animation)
		if (!hasRightColumn && stableKey === lastWidgetContent) {
			return;
		}
		lastWidgetContent = stableKey;

		// Use function form of setWidget for responsive width-based layout
		ctx.ui.setWidget("1-tasks", (_tui, _theme) => ({
			render(width: number): string[] {
				const useSideBySide = width >= MIN_SIDE_BY_SIDE_WIDTH && hasTasks && hasRightColumn;

				if (useSideBySide) {
					// Side-by-side: tasks on left, subagents + bg tasks on right (bottom-aligned)
					const separator = "\x1b[38;2;60;60;70m  │  \x1b[0m"; // Dark gray
					const separatorWidth = 5; // "  │  " is 5 visible chars
					const columnWidth = Math.floor((width - separatorWidth) / 2);

					// Adjust max lengths for column width
					const maxTitleLen = Math.max(20, columnWidth - 8);
					const maxTaskPreviewLen = Math.max(15, columnWidth - 25);
					const maxCmdLen = Math.max(15, columnWidth - 15);

					const taskLines = renderTaskLines(ctx, maxTitleLen);

					// Build right column: subagents on top, bg tasks on bottom
					const rightLines: string[] = [];
					if (hasSubagents) {
						rightLines.push(...renderSubagentLines(ctx, spinner, fgRunning, bgRunning, maxTaskPreviewLen, true));
					}
					if (hasBgTasks) {
						if (hasSubagents) rightLines.push(""); // Spacer
						rightLines.push(...renderBgBashLines(ctx, maxCmdLen));
					}

					return mergeSideBySide(taskLines, rightLines, columnWidth, separator);
				}

				// Stacked layout (narrow terminal or only one section)
				const maxTitleLen = 50;
				const maxTaskPreviewLen = 35;
				const maxCmdLen = 40;
				const lines: string[] = [];

				if (hasTasks) {
					lines.push(...renderTaskLines(ctx, maxTitleLen));
				}

				if (hasSubagents) {
					if (lines.length > 0) lines.push(""); // Spacer
					lines.push(...renderSubagentLines(ctx, spinner, fgRunning, bgRunning, maxTaskPreviewLen, !hasTasks));
				}

				if (hasBgTasks) {
					if (lines.length > 0) lines.push(""); // Spacer
					lines.push(...renderBgBashLines(ctx, maxCmdLen));
				}

				return lines;
			},
			invalidate(): void {
				// No caching needed - state is external
			},
		}));
	}

	// Persist state
	function persistState(): void {
		pi.appendEntry("tasks-state", {
			tasks: state.tasks,
			activeTaskId: state.activeTaskId,
			visible: state.visible,
		});
	}

	// Add a new task
	function addTask(title: string, dependencies: string[] = []): Task {
		const task: Task = {
			id: generateTaskId(),
			title,
			status: "pending",
			dependencies,
			createdAt: Date.now(),
		};
		state.tasks.push(task);
		return task;
	}

	// Update task status
	function updateTaskStatus(taskId: string, status: TaskStatus): boolean {
		const task = state.tasks.find((t) => t.id === taskId);
		if (!task) return false;

		// If completing, check dependencies
		if (status === "completed") {
			const unmetDeps = task.dependencies.filter((depId) => {
				const dep = state.tasks.find((t) => t.id === depId);
				return dep && dep.status !== "completed";
			});
			if (unmetDeps.length > 0) {
				return false; // Can't complete task with unmet dependencies
			}
			task.completedAt = Date.now();
		}

		// If setting in_progress, clear other in_progress tasks
		if (status === "in_progress") {
			for (const t of state.tasks) {
				if (t.status === "in_progress") {
					t.status = "pending";
				}
			}
			state.activeTaskId = taskId;
		}

		task.status = status;
		return true;
	}

	// Delete a task
	function deleteTask(taskId: string): boolean {
		const index = state.tasks.findIndex((t) => t.id === taskId);
		if (index === -1) return false;

		state.tasks.splice(index, 1);

		// Remove from other tasks' dependencies
		for (const task of state.tasks) {
			task.dependencies = task.dependencies.filter((id) => id !== taskId);
		}

		if (state.activeTaskId === taskId) {
			state.activeTaskId = null;
		}

		return true;
	}

	// Clear all tasks
	function clearTasks(): void {
		state.tasks = [];
		state.activeTaskId = null;
	}

	// Toggle visibility
	function toggleVisibility(ctx: ExtensionContext): void {
		state.visible = !state.visible;
		updateWidget(ctx);
		persistState();
		ctx.ui.notify(state.visible ? "Task list shown" : "Task list hidden", "info");
	}

	// Register /tasks command
	pi.registerCommand("tasks", {
		description: "Manage tasks - list, add, complete, delete, clear",
		handler: async (args, ctx) => {
			const parts = args.trim().split(/\s+/);
			const subcommand = parts[0]?.toLowerCase() || "list";
			const rest = parts.slice(1).join(" ");

			switch (subcommand) {
				case "list":
				case "show": {
					if (state.tasks.length === 0) {
						ctx.ui.notify("No tasks. Ask Claude to create a plan or use /tasks add <task>", "info");
						return;
					}
					const list = state.tasks
						.map((t, i) => {
							const icon = t.status === "completed" ? "✓" : t.status === "in_progress" ? "▣" : "☐";
							const deps = t.dependencies.length > 0 ? ` (depends on: ${t.dependencies.length} tasks)` : "";
							return `${i + 1}. ${icon} ${t.title}${deps}`;
						})
						.join("\n");
					ctx.ui.notify(`Tasks:\n${list}`, "info");
					break;
				}

				case "add": {
					if (!rest) {
						ctx.ui.notify("Usage: /tasks add <task description>", "error");
						return;
					}
					const task = addTask(rest);
					updateWidget(ctx);
					persistState();
					ctx.ui.notify(`Added task: ${task.title}`, "info");
					break;
				}

				case "complete":
				case "done": {
					const num = parseInt(rest, 10);
					if (Number.isNaN(num) || num < 1 || num > state.tasks.length) {
						ctx.ui.notify(`Usage: /tasks complete <number> (1-${state.tasks.length})`, "error");
						return;
					}
					const task = state.tasks[num - 1];
					if (updateTaskStatus(task.id, "completed")) {
						updateWidget(ctx);
						persistState();
						ctx.ui.notify(`Completed: ${task.title}`, "info");
					} else {
						ctx.ui.notify("Cannot complete task - dependencies not met", "error");
					}
					break;
				}

				case "start":
				case "active": {
					const num = parseInt(rest, 10);
					if (Number.isNaN(num) || num < 1 || num > state.tasks.length) {
						ctx.ui.notify(`Usage: /tasks start <number> (1-${state.tasks.length})`, "error");
						return;
					}
					const task = state.tasks[num - 1];
					updateTaskStatus(task.id, "in_progress");
					updateWidget(ctx);
					persistState();
					ctx.ui.notify(`Started: ${task.title}`, "info");
					break;
				}

				case "delete":
				case "remove": {
					const num = parseInt(rest, 10);
					if (Number.isNaN(num) || num < 1 || num > state.tasks.length) {
						ctx.ui.notify(`Usage: /tasks delete <number> (1-${state.tasks.length})`, "error");
						return;
					}
					const task = state.tasks[num - 1];
					deleteTask(task.id);
					updateWidget(ctx);
					persistState();
					ctx.ui.notify(`Deleted: ${task.title}`, "info");
					break;
				}

				case "clear": {
					const count = state.tasks.length;
					clearTasks();
					updateWidget(ctx);
					persistState();
					ctx.ui.notify(`Cleared ${count} tasks`, "info");
					break;
				}

				case "toggle":
				case "hide": {
					toggleVisibility(ctx);
					break;
				}

				default:
					ctx.ui.notify(
						"Usage: /tasks [list|add|complete|start|delete|clear|toggle]\n" +
							"  list          - Show all tasks\n" +
							"  add <task>    - Add a new task\n" +
							"  complete <n>  - Mark task n as completed\n" +
							"  start <n>     - Mark task n as in-progress\n" +
							"  delete <n>    - Delete task n\n" +
							"  clear         - Clear all tasks\n" +
							"  toggle        - Show/hide task widget",
						"info"
					);
			}
		},
	});

	// Note: /todos is provided by plan-mode extension, so we don't register it here
	// Use /tasks list instead

	// Register Ctrl+Shift+T shortcut for task list (Ctrl+T is built-in)
	pi.registerShortcut(Key.ctrlShift("t"), {
		description: "Toggle task list visibility",
		handler: async (ctx) => toggleVisibility(ctx),
	});

	// Tool for agent to manage tasks programmatically
	pi.registerTool({
		name: "manage_tasks",
		label: "Manage Tasks",
		description: `Manage the task list - clear all tasks, complete specific tasks, or add new ones.

WHEN TO CREATE TASKS:
- User explicitly asks for a task list or plan
- Multi-step work spanning multiple conversation turns
- User needs to see progress on complex work

WHEN TO SKIP:
- Quick single action (1-2 items, doing immediately)
- User didn't ask and work is straightforward

IMPORTANT RULES:
- If user explicitly asks for tasks, ALWAYS create them
- If [ACTIVE TASKS] shown in message, continue those tasks
- If conversation moved on to different topic, clear stale tasks immediately
- Complete tasks as you finish them (auto-advances to next)
- Tasks auto-clear 2 seconds after all complete`,
		parameters: Type.Object({
			action: Type.String({
				description:
					"Action: clear (remove all), complete_all (mark all done), list (show current), add (new task), complete (mark one done)",
			}),
			task: Type.Optional(
				Type.String({
					description: "Task title (for add action)",
				})
			),
			tasks: Type.Optional(
				Type.Array(Type.String(), {
					description: "Multiple task titles to add at once",
				})
			),
			index: Type.Optional(
				Type.Number({
					description: "Task number to complete (1-indexed, for complete action)",
				})
			),
			indices: Type.Optional(
				Type.Array(Type.Number(), {
					description: "Multiple task numbers to complete at once (1-indexed)",
				})
			),
		}),
		async execute(
			_toolCallId: string,
			params: { action: string; task?: string; tasks?: string[]; index?: number; indices?: number[] },
			_signal: AbortSignal | undefined,
			_onUpdate: any,
			ctx: ExtensionContext
		) {
			switch (params.action) {
				case "clear": {
					const count = state.tasks.length;
					clearTasks();
					updateWidget(ctx);
					persistState();
					return { details: {}, content: [{ type: "text", text: `Cleared ${count} tasks.` }] };
				}
				case "add": {
					// Batch add multiple tasks
					if (params.tasks && params.tasks.length > 0) {
						// ATOMIC: Build new list without intermediate empty state (prevents widget flicker)
						const pendingTasks = state.tasks.filter((t) => t.status !== "completed");
						const wasEmpty = pendingTasks.length === 0;

						const newTasks: Task[] = [];
						for (const title of params.tasks) {
							newTasks.push({
								id: generateTaskId(),
								title,
								status: "pending",
								dependencies: [],
								createdAt: Date.now(),
							});
						}

						// Single atomic assignment
						state.tasks = [...pendingTasks, ...newTasks];

						// Auto-start first task if list was empty
						if (wasEmpty && state.tasks.length > 0) {
							updateTaskStatus(state.tasks[0].id, "in_progress");
						}
						updateWidget(ctx);
						persistState();
						return { details: {}, content: [{ type: "text", text: `Added ${params.tasks.length} tasks` }] };
					}
					// Single task add
					if (!params.task) {
						return { details: {}, content: [{ type: "text", text: "Missing task title" }] };
					}
					const newTask = addTask(params.task);
					// Auto-start if first task
					if (state.tasks.length === 1) {
						updateTaskStatus(newTask.id, "in_progress");
					}
					updateWidget(ctx);
					persistState();
					return { details: {}, content: [{ type: "text", text: `Added: ${params.task}` }] };
				}
				case "complete": {
					// Support completing multiple tasks at once
					if (params.indices && params.indices.length > 0) {
						const completed: string[] = [];
						for (const i of params.indices) {
							const idx = i - 1;
							if (idx >= 0 && idx < state.tasks.length) {
								const task = state.tasks[idx];
								if (task.status !== "completed") {
									updateTaskStatus(task.id, "completed");
									completed.push(task.title);
								}
							}
						}
						// Start next pending task
						const nextPending = state.tasks.find((t) => t.status === "pending");
						if (nextPending) {
							updateTaskStatus(nextPending.id, "in_progress");
						}
						updateWidget(ctx);
						persistState();
						// Auto-clear if all done
						if (state.tasks.every((t) => t.status === "completed")) {
							setTimeout(() => {
								state.tasks = [];
								updateWidget(ctx);
								persistState();
							}, 2000);
						}
						return {
							details: {},
							content: [{ type: "text", text: `Completed ${completed.length} tasks: ${completed.join(", ")}` }],
						};
					}

					// Single task completion
					const idx = (params.index || 1) - 1;
					if (idx < 0 || idx >= state.tasks.length) {
						return { details: {}, content: [{ type: "text", text: `Invalid task number` }] };
					}
					const taskToComplete = state.tasks[idx];
					updateTaskStatus(taskToComplete.id, "completed");
					// Start next pending task
					const nextPendingSingle = state.tasks.find((t) => t.status === "pending");
					if (nextPendingSingle) {
						updateTaskStatus(nextPendingSingle.id, "in_progress");
					}
					updateWidget(ctx);
					persistState();
					// Auto-clear if all done
					if (state.tasks.every((t) => t.status === "completed")) {
						setTimeout(() => {
							state.tasks = [];
							updateWidget(ctx);
							persistState();
						}, 2000);
					}
					return { details: {}, content: [{ type: "text", text: `Completed: ${taskToComplete.title}` }] };
				}
				case "complete_all":
					for (const task of state.tasks) {
						task.status = "completed";
						task.completedAt = Date.now();
					}
					state.activeTaskId = null;
					updateWidget(ctx);
					persistState();
					setTimeout(() => {
						state.tasks = [];
						updateWidget(ctx);
						persistState();
					}, 1000);
					return {
						details: {},
						content: [{ type: "text", text: `Marked ${state.tasks.length} tasks complete. Will auto-clear.` }],
					};
				case "list": {
					if (state.tasks.length === 0) {
						return { details: {}, content: [{ type: "text", text: "No tasks." }] };
					}
					const list = state.tasks.map((t, i) => `${i + 1}. [${t.status}] ${t.title}`).join("\n");
					return { details: {}, content: [{ type: "text", text: list }] };
				}
				default:
					return { details: {}, content: [{ type: "text", text: `Unknown action: ${params.action}` }] };
			}
		},
	});

	// Auto-extract tasks from assistant messages
	pi.on("turn_end", async (event, ctx) => {
		if (!isAssistantMessage(event.message)) return;

		const text = getTextContent(event.message);

		// Check for completed tasks
		if (state.tasks.length > 0) {
			const completedIds = findCompletedTasks(text, state.tasks);
			for (const id of completedIds) {
				updateTaskStatus(id, "completed");
			}

			// Auto-advance: if current task completed, start next pending
			if (state.activeTaskId && completedIds.includes(state.activeTaskId)) {
				const nextPending = state.tasks.find((t) => t.status === "pending");
				if (nextPending) {
					updateTaskStatus(nextPending.id, "in_progress");
				} else {
					state.activeTaskId = null;
				}
			}

			// Auto-clear: if all tasks completed, clear the list after a brief delay
			const allCompleted = state.tasks.length > 0 && state.tasks.every((t) => t.status === "completed");
			if (allCompleted) {
				// Clear after showing completion briefly
				setTimeout(() => {
					if (state.tasks.every((t) => t.status === "completed")) {
						state.tasks = [];
						state.activeTaskId = null;
						updateWidget(ctx);
						persistState();
					}
				}, 2000); // 2 second delay to show completion
			}
		}

		// DISABLED: Auto-extraction was too aggressive and extracted random bullet points
		// To create tasks, use /tasks add <task> manually
		// Or explicitly ask the agent to create a task plan with /plan

		updateWidget(ctx);
		persistState();
	});

	// Inject task context before agent starts
	pi.on("before_agent_start", async () => {
		if (state.tasks.length === 0) return;

		const pending = state.tasks.filter((t) => t.status !== "completed");
		if (pending.length === 0) return;

		const taskList = pending
			.map((t, i) => {
				const status = t.status === "in_progress" ? " [IN PROGRESS]" : "";
				return `${i + 1}. ${t.title}${status}`;
			})
			.join("\n");

		const activeTask = state.tasks.find((t) => t.id === state.activeTaskId);
		const focusText = activeTask ? `\nCurrent focus: ${activeTask.title}` : "";

		return {
			message: {
				customType: "tasks-context",
				content: `[ACTIVE TASKS]
${taskList}
${focusText}

When you complete a task, mark it with [DONE] or include "completed:" followed by the task description.`,
				display: false,
			},
		};
	});

	// Interval for updating background subagents/tasks display
	// Store interval on globalThis so we can clear it across reloads
	const G = globalThis as any;
	if (G.__piTasksInterval) {
		clearInterval(G.__piTasksInterval);
	}
	let lastBgCount = 0;
	let lastBgTaskCount = 0;

	// Restore state on session start
	pi.on("session_start", async (_event, ctx) => {
		const entries = ctx.sessionManager.getEntries();

		// Find most recent tasks-state entry
		const stateEntry = entries
			.filter((e: { type: string; customType?: string }) => e.type === "custom" && e.customType === "tasks-state")
			.pop() as { data?: TasksState } | undefined;

		if (stateEntry?.data) {
			state.tasks = stateEntry.data.tasks || [];
			state.activeTaskId = stateEntry.data.activeTaskId || null;
			state.visible = stateEntry.data.visible ?? true;
		}

		updateWidget(ctx);

		// Start interval to animate subagents and background tasks
		if (G.__piTasksInterval) clearInterval(G.__piTasksInterval);
		G.__piTasksInterval = setInterval(() => {
			const fgSubagents = (globalThis as any).__piRunningSubagents as Map<string, any> | undefined;
			const bgSubagents = (globalThis as any).__piBackgroundSubagents as Map<string, any> | undefined;
			const bgTasks = (globalThis as any).__piBackgroundTasks as Map<string, any> | undefined;

			const fgRunning = fgSubagents ? fgSubagents.size : 0;
			const bgRunning = bgSubagents ? [...bgSubagents.values()].filter((s: any) => s.status === "running").length : 0;
			const bgTaskRunning = bgTasks ? [...bgTasks.values()].filter((t: any) => t.status === "running").length : 0;
			const hasActiveTask = state.tasks.some((t) => t.status === "in_progress");

			const hasRunning = fgRunning > 0 || bgRunning > 0 || bgTaskRunning > 0 || hasActiveTask;

			// Update on every tick when background items running (for animation), or when count changes
			if (hasRunning || bgRunning !== lastBgCount || bgTaskRunning !== lastBgTaskCount) {
				spinnerFrame++;
				lastBgCount = bgRunning;
				lastBgTaskCount = bgTaskRunning;
				updateWidget(ctx);
			}
		}, 200); // Faster interval for smoother animation
	});

	// Cleanup on session end
	pi.on("session_shutdown", async () => {
		persistState();
	});
}
