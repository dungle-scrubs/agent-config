/**
 * Tasks Extension for Pi
 *
 * Task management with cross-session persistence, inspired by Claude Code's
 * Beads-derived task system:
 * - Three states: pending (☐), in-progress (◉), completed (☑)
 * - Bidirectional dependency tracking (blocks/blockedBy)
 * - Comments for cross-session handoff context
 * - Cross-session persistence via PI_TASK_LIST_ID env var
 * - Multi-session coordination via fs.watch
 * - One file per task (avoids write conflicts)
 * - Status widget with dynamic sizing
 * - Ctrl+Shift+T to toggle visibility
 * - /tasks command to view/manage
 *
 * NOTE: This extension only runs in the main Pi process, not in subagent workers.
 */

import { randomUUID } from "node:crypto";
import type { FSWatcher } from "node:fs";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmdirSync,
	unlinkSync,
	watch,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { AssistantMessage, TextContent } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Key, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";

// ── Constants ────────────────────────────────────────────────────────────────

/** Directory root for shared task list files. */
const TASKS_DIR = join(homedir(), ".pi", "tasks");

// Minimum width for side-by-side layout (tasks left, subagents right)
const MIN_SIDE_BY_SIDE_WIDTH = 120;

// ── Task Types ───────────────────────────────────────────────────────────────

/** Lifecycle state of a task. */
type TaskStatus = "pending" | "in_progress" | "completed" | "deleted";

/** A comment attached to a task for cross-session context. */
interface TaskComment {
	author: string;
	content: string;
	timestamp: number;
}

/** A single task with subject, description, bidirectional deps, and comments. */
interface Task {
	/** Sequential integer ID as string ("1", "2", ...). */
	id: string;
	/** Short summary (was "title" in old schema). */
	subject: string;
	/** Detailed description — survives context compaction. */
	description?: string;
	/** Present continuous form shown in spinner when in_progress (e.g. "Running tests"). */
	activeForm?: string;
	status: TaskStatus;
	/** Task IDs this task blocks (forward deps). */
	blocks: string[];
	/** Task IDs that block this task (reverse deps). */
	blockedBy: string[];
	/** Audit trail / handoff context — persists across sessions. */
	comments: TaskComment[];
	/** Agent that claimed this task (passive, no enforcement yet). */
	owner?: string;
	/** Arbitrary key-value metadata. Set a key to null to delete it. */
	metadata?: Record<string, unknown>;
	createdAt: number;
	completedAt?: number;
}

// ── View Types (read from globalThis) ────────────────────────────────────────

/** Shape of background task entries read from globalThis.__piBackgroundTasks */
interface BgTaskView {
	id: string;
	command: string;
	status: string;
	startTime: number;
}

/** Shape of subagent entries read from globalThis.__piRunning/BackgroundSubagents */
interface SubagentView {
	id: string;
	agent: string;
	task: string;
	status?: string;
	startTime: number;
}

// ── Agent Activity Tracking ───────────────────────────────────────────────────

/** Live activity status for a running subagent (updated via event bus). */
interface AgentActivity {
	toolName: string;
	summary: string;
	timestamp: number;
}

/**
 * Tracks the current activity of each running subagent by agent_id.
 * Populated from subagent_tool_call events, cleared on subagent_stop.
 */
const agentActivity = new Map<string, AgentActivity>();

/** Agent color palette for teammate display (CC-style). */
const AGENT_COLORS: readonly string[] = ["green", "cyan", "magenta", "yellow", "blue", "red"] as const;

/**
 * Assigns a deterministic color to an agent name via hash.
 * @param name - Agent name to hash
 * @returns ANSI color name
 */
function agentColor(name: string): string {
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = Math.trunc(hash * 31 + name.charCodeAt(i));
	}
	return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length];
}

/**
 * Builds a human-readable summary from a tool call.
 * @param toolName - Name of the tool being called
 * @param toolInput - Tool input parameters
 * @returns Short activity description
 */
function summarizeToolCall(toolName: string, toolInput: Record<string, unknown>): string {
	switch (toolName) {
		case "bash": {
			const cmd = String(toolInput.command ?? "");
			const firstLine = cmd.split("\n")[0];
			return firstLine.length > 40 ? `${firstLine.slice(0, 37)}...` : firstLine;
		}
		case "read":
			return `Reading ${String(toolInput.path ?? "")}`;
		case "edit":
			return `Editing ${String(toolInput.path ?? "")}`;
		case "write":
			return `Writing ${String(toolInput.path ?? "")}`;
		case "grep":
			return `Searching: ${String(toolInput.pattern ?? "")}`;
		case "find":
			return `Finding: ${String(toolInput.pattern ?? "")}`;
		case "ls":
			return `Listing ${String(toolInput.path ?? ".")}`;
		default:
			return toolName;
	}
}

// ── Widget State ─────────────────────────────────────────────────────────────

/** Complete tasks widget state including visibility and active task tracking. */
interface TasksState {
	tasks: Task[];
	visible: boolean;
	activeTaskId: string | null;
	/** Next sequential ID counter. */
	nextId: number;
}

// ── TaskListStore ────────────────────────────────────────────────────────────

/**
 * Persistent, file-backed task store for cross-session sharing.
 *
 * When PI_TASK_LIST_ID is set, each task is stored as a separate JSON file
 * in ~/.pi/tasks/<list-id>/<task-id>.json. fs.watch on the directory detects
 * changes from other sessions.
 *
 * Without the env var, this store is inactive and the extension falls back
 * to session-entry persistence.
 */
class TaskListStore {
	private readonly dirPath: string | null;
	private watcher: FSWatcher | null = null;
	private onChange: (() => void) | null = null;
	/** Debounce timer to coalesce rapid file change events. */
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
	/** Set of filenames we just wrote — ignore their fs.watch events. */
	private readonly recentWrites = new Set<string>();

	/**
	 * @param listId - Task list identifier from PI_TASK_LIST_ID, or null for session-only mode
	 */
	constructor(listId: string | null) {
		if (listId) {
			const safeId = listId.replace(/[^a-zA-Z0-9._-]/g, "_");
			this.dirPath = join(TASKS_DIR, safeId);
			mkdirSync(this.dirPath, { recursive: true });
		} else {
			this.dirPath = null;
		}
	}

	/** @returns Whether this store is in shared (file-backed) mode. */
	get isShared(): boolean {
		return this.dirPath !== null;
	}

	/** @returns The resolved directory path, or null in session-only mode. */
	get path(): string | null {
		return this.dirPath;
	}

	/**
	 * Load all tasks from the shared directory.
	 * @returns Array of tasks sorted by ID, or null if not in shared mode.
	 */
	loadAll(): Task[] | null {
		if (!this.dirPath) return null;
		if (!existsSync(this.dirPath)) return [];

		const tasks: Task[] = [];
		try {
			const files = readdirSync(this.dirPath).filter((f) => f.endsWith(".json"));
			for (const file of files) {
				try {
					const raw = readFileSync(join(this.dirPath, file), "utf-8");
					const parsed = JSON.parse(raw) as Record<string, unknown>;
					// Migrate old schema: title → subject, dependencies → blockedBy
					if (parsed.title && !parsed.subject) {
						parsed.subject = parsed.title;
						parsed.title = undefined;
					}
					if (parsed.dependencies && !parsed.blockedBy) {
						parsed.blockedBy = parsed.dependencies;
						parsed.dependencies = undefined;
					}
					const task = parsed as unknown as Task;
					task.blocks = task.blocks ?? [];
					task.blockedBy = task.blockedBy ?? [];
					task.comments = task.comments ?? [];
					tasks.push(task);
				} catch {
					// Skip corrupt files
				}
			}
		} catch {
			return [];
		}

		return tasks.sort((a, b) => Number(a.id) - Number(b.id));
	}

	/**
	 * Acquire a directory-based lock for the task store. Returns a release function.
	 * Uses mkdirSync which is atomic on POSIX — fails if dir exists.
	 * Spins with exponential backoff up to ~1s, then proceeds unlocked.
	 * @returns Release function to call when done
	 */
	lock(): () => void {
		if (!this.dirPath) return () => {};
		const lockDir = join(this.dirPath, ".lock");
		let acquired = false;
		for (let attempt = 0; attempt < 10; attempt++) {
			try {
				mkdirSync(lockDir);
				acquired = true;
				break;
			} catch {
				// Lock held — spin with exponential backoff
				const waitMs = Math.min(10 * 2 ** attempt, 200);
				const start = Date.now();
				while (Date.now() - start < waitMs) {
					// busy-wait (synchronous lock needed for synchronous callers)
				}
			}
		}
		if (!acquired) {
			// Stale lock? Force remove and retry once
			try {
				rmdirSync(lockDir);
				mkdirSync(lockDir);
				acquired = true;
			} catch {
				// Proceed unlocked — best effort
			}
		}
		return () => {
			try {
				rmdirSync(lockDir);
			} catch {
				// Already released
			}
		};
	}

	/**
	 * Save a single task to its own file, atomically (write tmp + rename).
	 * @param task - Task to persist
	 */
	saveTask(task: Task): void {
		if (!this.dirPath) return;

		const filename = `${task.id}.json`;
		const filePath = join(this.dirPath, filename);
		const tmpPath = join(this.dirPath, `.${filename}.${randomUUID().slice(0, 8)}.tmp`);
		const unlock = this.lock();

		try {
			this.recentWrites.add(filename);
			writeFileSync(tmpPath, JSON.stringify(task, null, 2), "utf-8");
			renameSync(tmpPath, filePath);
			setTimeout(() => this.recentWrites.delete(filename), 200);
		} catch {
			this.recentWrites.delete(filename);
			try {
				writeFileSync(filePath, JSON.stringify(task, null, 2), "utf-8");
			} catch {
				// Silent — state still in session entries
			}
		} finally {
			unlock();
		}
	}

	/**
	 * Delete a task file.
	 * @param taskId - ID of the task to remove
	 */
	deleteTask(taskId: string): void {
		if (!this.dirPath) return;
		const filename = `${taskId}.json`;
		const filePath = join(this.dirPath, filename);
		const unlock = this.lock();
		try {
			this.recentWrites.add(filename);
			if (existsSync(filePath)) unlinkSync(filePath);
			setTimeout(() => this.recentWrites.delete(filename), 200);
		} catch {
			this.recentWrites.delete(filename);
		} finally {
			unlock();
		}
	}

	/**
	 * Delete all task files in the directory.
	 */
	deleteAll(): void {
		if (!this.dirPath) return;
		try {
			const files = readdirSync(this.dirPath).filter((f) => f.endsWith(".json"));
			for (const file of files) {
				this.recentWrites.add(file);
				try {
					unlinkSync(join(this.dirPath, file));
				} catch {
					// skip
				}
				setTimeout(() => this.recentWrites.delete(file), 200);
			}
		} catch {
			// skip
		}
	}

	/**
	 * Start watching the task directory for external changes.
	 * @param callback - Invoked when another session modifies a task file
	 */
	watch(callback: () => void): void {
		if (!this.dirPath) return;

		this.onChange = callback;

		try {
			this.watcher = watch(this.dirPath, (_, changedFile) => {
				if (!changedFile?.endsWith(".json")) return;
				if (this.recentWrites.has(changedFile)) return;

				// Debounce: coalesce rapid events
				if (this.debounceTimer) clearTimeout(this.debounceTimer);
				this.debounceTimer = setTimeout(() => {
					this.debounceTimer = null;
					this.onChange?.();
				}, 150);
			});
		} catch {
			// fs.watch can fail on some filesystems — degrade gracefully
		}
	}

	/** Stop watching and clean up resources. */
	close(): void {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
		if (this.watcher) {
			this.watcher.close();
			this.watcher = null;
		}
		this.onChange = null;
	}
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
 * Generates the next sequential task ID from the state counter.
 * @param state - Current tasks state (mutates nextId)
 * @returns Sequential ID string ("1", "2", ...)
 */
function nextTaskId(state: TasksState): string {
	const id = String(state.nextId);
	state.nextId++;
	return id;
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
	for (const match of text.matchAll(numberedRegex)) {
		const task = match[2].trim();
		if (task && !task.startsWith("[") && task.length > 3) {
			tasks.push(task);
		}
	}

	// Match checkbox lists: "- [ ] task", "- [x] task", "* [ ] task"
	const checkboxRegex = /^\s*[-*]\s*\[[ x]\]\s+(.+)$/gim;
	for (const match of text.matchAll(checkboxRegex)) {
		const task = match[1].trim();
		if (task && task.length > 3) {
			tasks.push(task);
		}
	}

	// Match "Task:" or "TODO:" headers followed by items
	const taskHeaderRegex = /(?:Tasks?|TODO|To-?do|Steps?):\s*\n((?:\s*[-*\d.]+.+\n?)+)/gi;
	for (const match of text.matchAll(taskHeaderRegex)) {
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
			new RegExp(`✓\\s*${escapeRegex(task.subject.substring(0, 30))}`, "i"),
			new RegExp(`completed:?\\s*${escapeRegex(task.subject.substring(0, 30))}`, "i"),
			new RegExp(`done:?\\s*${escapeRegex(task.subject.substring(0, 30))}`, "i"),
			new RegExp(`\\[x\\]\\s*${escapeRegex(task.subject.substring(0, 30))}`, "i"),
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
	const isSubagent = process.env.PI_IS_SUBAGENT === "1";
	const state: TasksState = {
		tasks: [],
		visible: true,
		activeTaskId: null,
		nextId: 1,
	};

	/** Turns since last manage_tasks tool use. Reset on tool call, incremented on turn_end. */
	let turnsSinceLastTaskTool = 0;
	const REMINDER_TURN_THRESHOLD = 10;

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

			const label = task.status === "in_progress" && task.activeForm ? task.activeForm : task.subject;
			const title = label.length > maxTitleLen ? `${label.substring(0, maxTitleLen - 3)}...` : label;
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
		fgRunning: Array<{ id: string; agent: string; task: string; startTime: number }>,
		bgRunning: Array<{ id: string; agent: string; task: string; startTime: number }>,
		maxTaskPreviewLen: number,
		_standalone: boolean
	): string[] {
		const allRunning = [...fgRunning, ...bgRunning];
		if (allRunning.length === 0) return [];

		const lines: string[] = [];
		const count = allRunning.length;
		lines.push(
			`${ctx.ui.theme.fg("accent", `${count} agent${count > 1 ? "s" : ""} launched`)} ${ctx.ui.theme.fg("muted", "(ctrl+o to expand)")}`
		);

		for (let i = 0; i < allRunning.length; i++) {
			const sub = allRunning[i];
			const isLast = i === allRunning.length - 1;
			const treeChar = isLast ? "└─" : "├─";
			const contChar = isLast ? " " : "│";
			const color = agentColor(sub.agent);
			const ms = Date.now() - sub.startTime;
			const secs = Math.floor(ms / 1000);
			const duration = secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m${secs % 60}s`;

			// Line 1: @agent-name with colored indicator
			lines.push(
				`${ctx.ui.theme.fg("muted", treeChar)} \x1b[38;5;${colorToAnsi(color)}m${spinner}\x1b[0m \x1b[1;38;5;${colorToAnsi(color)}m@${sub.agent}\x1b[0m ${ctx.ui.theme.fg("muted", `· ${duration}`)}`
			);

			// Line 2: task description
			const taskPreview =
				sub.task.length > maxTaskPreviewLen ? `${sub.task.slice(0, maxTaskPreviewLen - 3)}...` : sub.task;
			lines.push(`${ctx.ui.theme.fg("muted", `${contChar}  `)} ${ctx.ui.theme.fg("dim", taskPreview)}`);

			// Line 3: live activity (if available)
			const activity = agentActivity.get(sub.id);
			if (activity) {
				const activityText =
					activity.summary.length > maxTaskPreviewLen
						? `${activity.summary.slice(0, maxTaskPreviewLen - 3)}...`
						: activity.summary;
				lines.push(`${ctx.ui.theme.fg("muted", `${contChar}  `)} ${ctx.ui.theme.fg("warning", activityText)}`);
			}
		}

		return lines;
	}

	/**
	 * Maps color names to ANSI 256-color codes.
	 * @param color - Color name string
	 * @returns ANSI 256-color code number
	 */
	function colorToAnsi(color: string): number {
		const map: Record<string, number> = {
			green: 78,
			cyan: 80,
			magenta: 170,
			yellow: 220,
			blue: 75,
			red: 203,
		};
		return map[color] ?? 78;
	}

	/**
	 * Render background bash task lines
	 */
	function renderBgBashLines(ctx: ExtensionContext, maxCmdLen: number): string[] {
		const bgTasksMap = globalThis.__piBackgroundTasks;
		if (!bgTasksMap) return [];

		const running = ([...bgTasksMap.values()] as unknown as BgTaskView[]).filter((t) => t.status === "running");
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
			// Collapse newlines and truncate to max length
			const flatCmd = task.command.replace(/\n/g, " ↵ ");
			const cmd = flatCmd.length > maxCmdLen ? `${flatCmd.slice(0, maxCmdLen - 3)}...` : flatCmd;
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
	 * Merge two column arrays into side-by-side lines, with right column bottom-aligned.
	 * Both columns are truncated to their allotted widths to prevent overflow.
	 * @param leftLines - Lines for the left column
	 * @param rightLines - Lines for the right column
	 * @param leftWidth - Max visible width for left column
	 * @param separator - Separator string between columns
	 * @param totalWidth - Total terminal width (for right column truncation)
	 */
	function mergeSideBySide(
		leftLines: string[],
		rightLines: string[],
		leftWidth: number,
		separator: string,
		totalWidth: number
	): string[] {
		const separatorWidth = visibleWidth(separator);
		const rightWidth = totalWidth - leftWidth - separatorWidth;
		const maxRows = Math.max(leftLines.length, rightLines.length);
		const result: string[] = [];

		// Bottom-align: pad right column at the top
		const rightPadding = maxRows - rightLines.length;

		for (let i = 0; i < maxRows; i++) {
			const left = leftLines[i] ?? "";
			const rightIndex = i - rightPadding;
			const rawRight = rightIndex >= 0 ? (rightLines[rightIndex] ?? "") : "";
			// Truncate right column to prevent overflow
			const right =
				rightWidth > 0 && visibleWidth(rawRight) > rightWidth ? truncateToWidth(rawRight, rightWidth, "") : rawRight;
			result.push(padToWidth(left, leftWidth) + separator + right);
		}

		return result;
	}

	function updateWidget(ctx: ExtensionContext): void {
		// Subagents have no UI — skip all widget rendering
		if (isSubagent) return;
		// Check for foreground (sync) and background subagents
		const fgSubagentsMap = globalThis.__piRunningSubagents;
		const bgSubagentsMap = globalThis.__piBackgroundSubagents;
		const bgTasksMap = globalThis.__piBackgroundTasks;

		const fgRunning: SubagentView[] = fgSubagentsMap ? ([...fgSubagentsMap.values()] as unknown as SubagentView[]) : [];
		const bgRunning = bgSubagentsMap
			? ([...bgSubagentsMap.values()] as unknown as SubagentView[]).filter((s) => s.status === "running")
			: [];
		const bgTasks = bgTasksMap
			? ([...bgTasksMap.values()] as unknown as BgTaskView[]).filter((t) => t.status === "running")
			: [];

		const hasSubagents = fgRunning.length > 0 || bgRunning.length > 0;
		const hasBgTasks = bgTasks.length > 0;
		const hasRightColumn = hasSubagents || hasBgTasks;
		const hasTasks = state.tasks.length > 0;

		if (!(state.visible && (hasTasks || hasRightColumn))) {
			if (lastWidgetContent !== "") {
				ctx.ui.setWidget("1-tasks", undefined);
				lastWidgetContent = "";
			}
			return;
		}

		const spinner = SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length];

		// Build stable key for structure changes
		const taskStates = state.tasks.map((t) => `${t.id}:${t.status}`).join(",");
		const fgIds = fgRunning.map((s) => s.id).join(",");
		const bgIds = bgRunning.map((s) => s.id).join(",");
		const bgTaskIds = bgTasks.map((t) => t.id).join(",");
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

					return mergeSideBySide(taskLines, rightLines, columnWidth, separator, width);
				}

				// Stacked layout (narrow terminal or only one section)
				// "├─ ◐ " prefix = 5 visible chars, leave room for width
				const maxTitleLen = Math.max(10, width - 5);
				const maxTaskPreviewLen = Math.max(15, width - 25);
				const maxCmdLen = Math.max(15, width - 15);
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

				// Safety net: truncate all lines to terminal width
				return lines.map((line) => (visibleWidth(line) > width ? truncateToWidth(line, width, "") : line));
			},
			invalidate(): void {
				// No caching needed - state is external
			},
		}));
	}

	// ── Store instance (shared or null) ─────────────────────────────

	// Auto-generate a shared task list ID so subagents can coordinate.
	// User can override with PI_TASK_LIST_ID env var.
	const taskListId = process.env.PI_TASK_LIST_ID ?? (isSubagent ? null : `session-${randomUUID().slice(0, 8)}`);
	if (taskListId && !process.env.PI_TASK_LIST_ID) {
		// Set on process.env so child subagents inherit it automatically
		process.env.PI_TASK_LIST_ID = taskListId;
	}
	const store = new TaskListStore(taskListId);

	// ── Persistence ─────────────────────────────────────────────────

	/**
	 * Persist current state. Routes to file store (shared mode) or session
	 * entries (session-only mode).
	 */
	function persistState(): void {
		if (store.isShared) {
			// In shared mode, individual task saves happen at mutation sites.
			// This saves the meta state (visibility, nextId) as a session entry
			// so widget prefs survive compaction even in shared mode.
			pi.appendEntry("tasks-state", {
				visible: state.visible,
				nextId: state.nextId,
				activeTaskId: state.activeTaskId,
			});
		} else {
			pi.appendEntry("tasks-state", {
				tasks: state.tasks,
				activeTaskId: state.activeTaskId,
				visible: state.visible,
				nextId: state.nextId,
			});
		}
	}

	/**
	 * Save a single task to the file store (no-op in session-only mode).
	 * @param task - Task to persist
	 */
	function persistTask(task: Task): void {
		store.saveTask(task);
	}

	/**
	 * Load tasks from the file store into state (shared mode only).
	 * @returns True if tasks were loaded from store
	 */
	function loadFromStore(): boolean {
		const tasks = store.loadAll();
		if (tasks === null) return false;
		state.tasks = tasks;
		// Recalculate nextId from loaded tasks
		const maxId = tasks.reduce((max, t) => Math.max(max, Number(t.id) || 0), 0);
		state.nextId = maxId + 1;
		// Restore activeTaskId from in_progress task
		const active = tasks.find((t) => t.status === "in_progress");
		state.activeTaskId = active?.id ?? null;
		return true;
	}

	// ── Task operations ─────────────────────────────────────────────

	/**
	 * Create a new task.
	 * @param subject - Short summary
	 * @param description - Optional detailed description
	 * @returns The created task
	 */
	function addTask(
		subject: string,
		opts?: { description?: string; activeForm?: string; metadata?: Record<string, unknown> }
	): Task {
		const task: Task = {
			id: nextTaskId(state),
			subject,
			description: opts?.description,
			activeForm: opts?.activeForm,
			status: "pending",
			blocks: [],
			blockedBy: [],
			comments: [],
			metadata: opts?.metadata,
			createdAt: Date.now(),
		};
		state.tasks.push(task);
		persistTask(task);
		return task;
	}

	/**
	 * Update a task's status with dependency enforcement.
	 * @param taskId - Task ID to update
	 * @param status - New status
	 * @returns True if update succeeded
	 */
	function updateTaskStatus(taskId: string, status: TaskStatus): boolean {
		const task = state.tasks.find((t) => t.id === taskId);
		if (!task) return false;

		// If completing, check blockedBy deps
		if (status === "completed") {
			const unmetDeps = task.blockedBy.filter((depId) => {
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
					persistTask(t);
				}
			}
			state.activeTaskId = taskId;
		}

		task.status = status;
		persistTask(task);
		return true;
	}

	/**
	 * Add bidirectional blocking relationships.
	 * @param taskId - Task to modify
	 * @param addBlocks - Task IDs this task should block
	 * @param addBlockedBy - Task IDs that should block this task
	 */
	function updateTaskDeps(taskId: string, addBlocks?: string[], addBlockedBy?: string[]): void {
		const task = state.tasks.find((t) => t.id === taskId);
		if (!task) return;

		if (addBlocks) {
			for (const targetId of addBlocks) {
				if (!task.blocks.includes(targetId)) task.blocks.push(targetId);
				// Mirror: add this task to target's blockedBy
				const target = state.tasks.find((t) => t.id === targetId);
				if (target && !target.blockedBy.includes(taskId)) {
					target.blockedBy.push(taskId);
					persistTask(target);
				}
			}
		}

		if (addBlockedBy) {
			for (const blockerId of addBlockedBy) {
				if (!task.blockedBy.includes(blockerId)) task.blockedBy.push(blockerId);
				// Mirror: add this task to blocker's blocks
				const blocker = state.tasks.find((t) => t.id === blockerId);
				if (blocker && !blocker.blocks.includes(taskId)) {
					blocker.blocks.push(taskId);
					persistTask(blocker);
				}
			}
		}

		persistTask(task);
	}

	/**
	 * Add a comment to a task.
	 * @param taskId - Task to add comment to
	 * @param author - Who wrote the comment
	 * @param content - Comment text
	 * @returns True if comment was added
	 */
	function addComment(taskId: string, author: string, content: string): boolean {
		const task = state.tasks.find((t) => t.id === taskId);
		if (!task) return false;

		task.comments.push({ author, content, timestamp: Date.now() });
		persistTask(task);
		return true;
	}

	/**
	 * Delete a task and clean up dep references.
	 * @param taskId - Task ID to remove
	 * @returns True if task was found and deleted
	 */
	function deleteTask(taskId: string): boolean {
		const index = state.tasks.findIndex((t) => t.id === taskId);
		if (index === -1) return false;

		state.tasks.splice(index, 1);

		// Remove from other tasks' deps (both directions)
		for (const task of state.tasks) {
			const hadBlock = task.blocks.includes(taskId);
			const hadBlockedBy = task.blockedBy.includes(taskId);
			task.blocks = task.blocks.filter((id) => id !== taskId);
			task.blockedBy = task.blockedBy.filter((id) => id !== taskId);
			if (hadBlock || hadBlockedBy) persistTask(task);
		}

		if (state.activeTaskId === taskId) {
			state.activeTaskId = null;
		}

		store.deleteTask(taskId);
		return true;
	}

	/**
	 * Clear all tasks.
	 */
	function clearTasks(): void {
		store.deleteAll();
		state.tasks = [];
		state.activeTaskId = null;
		// Don't reset nextId — avoids ID reuse across clears
	}

	// Toggle visibility
	function toggleVisibility(ctx: ExtensionContext): void {
		state.visible = !state.visible;
		updateWidget(ctx);
		persistState();
		ctx.ui.notify(state.visible ? "Task list shown" : "Task list hidden", "info");
	}

	// Register /tasks command (main process only — subagents have no interactive UI)
	if (!isSubagent)
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
							.map((t) => {
								const icon = t.status === "completed" ? "✓" : t.status === "in_progress" ? "▣" : "☐";
								const blocked = t.blockedBy.length > 0 ? ` (blocked by: ${t.blockedBy.join(", ")})` : "";
								const comments = t.comments.length > 0 ? ` 💬${t.comments.length}` : "";
								return `${t.id}. ${icon} ${t.subject}${blocked}${comments}`;
							})
							.join("\n");
						const mode = store.isShared ? ` [shared: ${process.env.PI_TASK_LIST_ID}]` : " [session-only]";
						ctx.ui.notify(`Tasks${mode}:\n${list}`, "info");
						break;
					}

					case "add": {
						if (!rest) {
							ctx.ui.notify("Usage: /tasks add <task subject>", "error");
							return;
						}
						const task = addTask(rest, {});
						updateWidget(ctx);
						persistState();
						ctx.ui.notify(`Added #${task.id}: ${task.subject}`, "info");
						break;
					}

					case "complete":
					case "done": {
						const num = Number.parseInt(rest, 10);
						if (Number.isNaN(num) || num < 1 || num > state.tasks.length) {
							ctx.ui.notify(`Usage: /tasks complete <number> (1-${state.tasks.length})`, "error");
							return;
						}
						const task = state.tasks[num - 1];
						if (updateTaskStatus(task.id, "completed")) {
							updateWidget(ctx);
							persistState();
							ctx.ui.notify(`Completed: ${task.subject}`, "info");
						} else {
							ctx.ui.notify("Cannot complete task - blocked by unfinished dependencies", "error");
						}
						break;
					}

					case "start":
					case "active": {
						const num = Number.parseInt(rest, 10);
						if (Number.isNaN(num) || num < 1 || num > state.tasks.length) {
							ctx.ui.notify(`Usage: /tasks start <number> (1-${state.tasks.length})`, "error");
							return;
						}
						const task = state.tasks[num - 1];
						updateTaskStatus(task.id, "in_progress");
						updateWidget(ctx);
						persistState();
						ctx.ui.notify(`Started: ${task.subject}`, "info");
						break;
					}

					case "delete":
					case "remove": {
						const num = Number.parseInt(rest, 10);
						if (Number.isNaN(num) || num < 1 || num > state.tasks.length) {
							ctx.ui.notify(`Usage: /tasks delete <number> (1-${state.tasks.length})`, "error");
							return;
						}
						const task = state.tasks[num - 1];
						deleteTask(task.id);
						updateWidget(ctx);
						persistState();
						ctx.ui.notify(`Deleted: ${task.subject}`, "info");
						break;
					}

					case "id": {
						if (rest) {
							ctx.ui.notify(
								`Set PI_TASK_LIST_ID=${rest} in your shell to enable shared tasks.\n` +
									"Then restart Pi. Runtime switching is not supported.",
								"info"
							);
						} else {
							const current = store.isShared ? process.env.PI_TASK_LIST_ID : "(none — session-only)";
							const path = store.path ?? "N/A";
							ctx.ui.notify(`Task list ID: ${current}\nPath: ${path}`, "info");
						}
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
							"Usage: /tasks [list|add|complete|start|delete|clear|toggle|id]\n" +
								"  list          - Show all tasks\n" +
								"  add <task>    - Add a new task\n" +
								"  complete <n>  - Mark task n as completed\n" +
								"  start <n>     - Mark task n as in-progress\n" +
								"  delete <n>    - Delete task n\n" +
								"  clear         - Clear all tasks\n" +
								"  toggle        - Show/hide task widget\n" +
								"  id [name]     - Show or set task list ID",
							"info"
						);
				}
			},
		});

	// Note: /todos is provided by plan-mode extension, so we don't register it here
	// Use /tasks list instead

	// Register Ctrl+Shift+T shortcut for task list (Ctrl+T is built-in)
	if (!isSubagent)
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
- Multi-step work spanning multiple conversation turns (3+ steps)
- User provides multiple tasks (numbered or comma-separated)
- Non-trivial tasks requiring careful planning or multiple operations
- After receiving new instructions — immediately capture requirements as tasks

WHEN TO SKIP:
- Single, straightforward task completable in 1-2 steps
- Purely conversational or informational requests
- User didn't ask and work is trivial

TASK STATES:
- pending: not yet started
- in_progress: currently working on (only ONE at a time)
- completed: finished successfully
- deleted: permanently removed (via update with status "deleted")

IMPORTANT RULES:
- If user explicitly asks for tasks, ALWAYS create them
- If [ACTIVE TASKS] shown in message, continue those tasks
- If conversation moved on to different topic, clear stale tasks immediately
- Complete tasks as you finish them (auto-advances to next)
- Tasks auto-clear 2 seconds after all complete
- ONLY mark a task completed when FULLY accomplished — not if tests fail, implementation is partial, or errors remain
- When blocked, keep task in_progress and create a new task for the blocker
- Always provide both subject (imperative: "Run tests") and activeForm (continuous: "Running tests")
- Use addComment to leave context for future sessions (why something was done, what was tried)
- Use addBlockedBy/addBlocks to set dependency chains between tasks
- Use get action with index to view full task details including metadata, comments, and timestamps

EXAMPLES:
- User: "Add dark mode, run tests when done" → Create tasks: 1) Add dark mode toggle component 2) Add dark mode state management 3) Update styles for theme switching 4) Run tests and fix failures
- User: "Rename getUserId to getUserIdentifier across the project" → Search first, then create per-file tasks if many occurrences found
- User: "What does git rebase do?" → Do NOT create tasks (informational, no action needed)
- User: "Fix the typo in README.md" → Do NOT create tasks (single trivial step)`,
		parameters: Type.Object({
			action: Type.String({
				description:
					"Action: clear (remove all), complete_all (mark all done), list (show current), add (new task), complete (mark one done), update (modify task), get (view full task details by index), claim (set owner with busy-check)",
			}),
			task: Type.Optional(
				Type.String({
					description: "Task subject/title (for add action)",
				})
			),
			tasks: Type.Optional(
				Type.Array(Type.String(), {
					description: "Multiple task subjects to add at once",
				})
			),
			description: Type.Optional(
				Type.String({
					description: "Detailed task description (for add or update action)",
				})
			),
			activeForm: Type.Optional(
				Type.String({
					description:
						'Present continuous form shown in spinner when task is in_progress (e.g. "Running tests"). Falls back to subject if not set.',
				})
			),
			metadata: Type.Optional(
				Type.Object(
					{},
					{
						description:
							"Arbitrary key-value metadata to attach to a task (for add or update). Set a key to null to delete it.",
						additionalProperties: true,
					}
				)
			),
			status: Type.Optional(
				Type.String({
					description:
						"New status for update action: pending, in_progress, completed, or deleted (permanently removes the task)",
				})
			),
			index: Type.Optional(
				Type.Number({
					description: "Task number to complete/update/get (1-indexed)",
				})
			),
			indices: Type.Optional(
				Type.Array(Type.Number(), {
					description: "Multiple task numbers to complete at once (1-indexed)",
				})
			),
			owner: Type.Optional(
				Type.String({
					description: "Agent name to set as task owner (for claim/update action)",
				})
			),
			addBlocks: Type.Optional(
				Type.Array(Type.String(), {
					description: "Task IDs that this task blocks (for update action)",
				})
			),
			addBlockedBy: Type.Optional(
				Type.Array(Type.String(), {
					description: "Task IDs that block this task (for update action)",
				})
			),
			addComment: Type.Optional(
				Type.Object({
					author: Type.String({ description: "Comment author (e.g. 'agent', 'user', agent name)" }),
					content: Type.String({ description: "Comment text — context for future sessions" }),
				})
			),
		}),
		async execute(
			_toolCallId: string,
			params: {
				action: string;
				task?: string;
				tasks?: string[];
				description?: string;
				activeForm?: string;
				metadata?: Record<string, unknown>;
				status?: string;
				owner?: string;
				index?: number;
				indices?: number[];
				addBlocks?: string[];
				addBlockedBy?: string[];
				addComment?: { author: string; content: string };
			},
			_signal: AbortSignal | undefined,
			_onUpdate: unknown,
			ctx: ExtensionContext
		) {
			turnsSinceLastTaskTool = 0;
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
						const pendingTasks = state.tasks.filter((t) => t.status !== "completed");
						const wasEmpty = pendingTasks.length === 0;

						for (const subject of params.tasks) {
							addTask(subject);
						}

						// Auto-start first task if list was empty
						if (wasEmpty && state.tasks.length > 0) {
							const firstPending = state.tasks.find((t) => t.status === "pending");
							if (firstPending) updateTaskStatus(firstPending.id, "in_progress");
						}
						updateWidget(ctx);
						persistState();
						return { details: {}, content: [{ type: "text", text: `Added ${params.tasks.length} tasks` }] };
					}
					// Single task add
					if (!params.task) {
						return { details: {}, content: [{ type: "text", text: "Missing task subject" }] };
					}
					const newTask = addTask(params.task, {
						description: params.description,
						activeForm: params.activeForm,
						metadata: params.metadata,
					});
					// Auto-start if first task
					if (state.tasks.length === 1) {
						updateTaskStatus(newTask.id, "in_progress");
					}
					updateWidget(ctx);
					persistState();
					return { details: {}, content: [{ type: "text", text: `Added #${newTask.id}: ${params.task}` }] };
				}
				case "update": {
					const updateIdx = (params.index || 1) - 1;
					if (updateIdx < 0 || updateIdx >= state.tasks.length) {
						return { details: {}, content: [{ type: "text", text: "Invalid task number" }] };
					}
					const taskToUpdate = state.tasks[updateIdx];

					// Handle deleted status — permanently removes the task
					if (params.status === "deleted") {
						const subject = taskToUpdate.subject;
						deleteTask(taskToUpdate.id);
						updateWidget(ctx);
						persistState();
						return { details: {}, content: [{ type: "text", text: `Deleted #${taskToUpdate.id}: ${subject}` }] };
					}

					const changes: string[] = [];

					if (params.status !== undefined) {
						const validStatuses = ["pending", "in_progress", "completed"];
						if (validStatuses.includes(params.status)) {
							updateTaskStatus(taskToUpdate.id, params.status as TaskStatus);
							changes.push(`status → ${params.status}`);
						}
					}
					if (params.description !== undefined) {
						taskToUpdate.description = params.description;
						changes.push("description");
					}
					if (params.activeForm !== undefined) {
						taskToUpdate.activeForm = params.activeForm;
						changes.push("activeForm");
					}
					if (params.metadata !== undefined) {
						const merged = { ...taskToUpdate.metadata };
						for (const [k, v] of Object.entries(params.metadata)) {
							if (v === null) delete merged[k];
							else merged[k] = v;
						}
						taskToUpdate.metadata = Object.keys(merged).length > 0 ? merged : undefined;
						changes.push("metadata");
					}
					if (params.addBlocks || params.addBlockedBy) {
						updateTaskDeps(taskToUpdate.id, params.addBlocks, params.addBlockedBy);
						changes.push("dependencies");
					}
					if (params.addComment) {
						addComment(taskToUpdate.id, params.addComment.author, params.addComment.content);
						changes.push("comment");
					}

					persistTask(taskToUpdate);
					updateWidget(ctx);
					persistState();
					return {
						details: {},
						content: [{ type: "text", text: `Updated #${taskToUpdate.id}: ${changes.join(", ")}` }],
					};
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
									completed.push(task.subject);
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
								clearTasks();
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
						return { details: {}, content: [{ type: "text", text: "Invalid task number" }] };
					}
					const taskToComplete = state.tasks[idx];
					// Add completion comment if provided
					if (params.addComment) {
						addComment(taskToComplete.id, params.addComment.author, params.addComment.content);
					}
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
							clearTasks();
							updateWidget(ctx);
							persistState();
						}, 2000);
					}
					return { details: {}, content: [{ type: "text", text: `Completed: ${taskToComplete.subject}` }] };
				}
				case "complete_all": {
					for (const task of state.tasks) {
						task.status = "completed";
						task.completedAt = Date.now();
						persistTask(task);
					}
					state.activeTaskId = null;
					updateWidget(ctx);
					persistState();
					setTimeout(() => {
						clearTasks();
						updateWidget(ctx);
						persistState();
					}, 1000);
					return {
						details: {},
						content: [{ type: "text", text: `Marked ${state.tasks.length} tasks complete. Will auto-clear.` }],
					};
				}
				case "list": {
					if (state.tasks.length === 0) {
						return { details: {}, content: [{ type: "text", text: "No tasks." }] };
					}
					const list = state.tasks
						.map((t) => {
							const blocked = t.blockedBy.length > 0 ? ` [blocked by: ${t.blockedBy.join(",")}]` : "";
							const comments = t.comments.length > 0 ? ` (${t.comments.length} comments)` : "";
							return `${t.id}. [${t.status}] ${t.subject}${blocked}${comments}`;
						})
						.join("\n");
					return { details: {}, content: [{ type: "text", text: list }] };
				}
				case "get": {
					const getIdx = (params.index || 1) - 1;
					if (getIdx < 0 || getIdx >= state.tasks.length) {
						return { details: {}, content: [{ type: "text", text: "Invalid task number" }] };
					}
					const t = state.tasks[getIdx];
					const lines = [`# Task #${t.id}: ${t.subject}`, `Status: ${t.status}`];
					if (t.activeForm) lines.push(`Active form: ${t.activeForm}`);
					if (t.description) lines.push(`Description: ${t.description}`);
					if (t.owner) lines.push(`Owner: ${t.owner}`);
					if (t.blocks.length > 0) lines.push(`Blocks: ${t.blocks.join(", ")}`);
					if (t.blockedBy.length > 0) lines.push(`Blocked by: ${t.blockedBy.join(", ")}`);
					if (t.metadata && Object.keys(t.metadata).length > 0) {
						lines.push(`Metadata: ${JSON.stringify(t.metadata)}`);
					}
					lines.push(`Created: ${new Date(t.createdAt).toISOString()}`);
					if (t.completedAt) lines.push(`Completed: ${new Date(t.completedAt).toISOString()}`);
					if (t.comments.length > 0) {
						lines.push(`\nComments (${t.comments.length}):`);
						for (const c of t.comments) {
							lines.push(`  [${new Date(c.timestamp).toISOString()}] ${c.author}: ${c.content}`);
						}
					}
					return { details: {}, content: [{ type: "text", text: lines.join("\n") }] };
				}
				case "claim": {
					if (!params.owner) {
						return { details: {}, content: [{ type: "text", text: "Missing owner for claim action" }] };
					}
					const claimIdx = (params.index || 1) - 1;
					if (claimIdx < 0 || claimIdx >= state.tasks.length) {
						return { details: {}, content: [{ type: "text", text: "Invalid task number" }] };
					}
					const taskToClaim = state.tasks[claimIdx];

					// Can't claim completed/deleted tasks
					if (taskToClaim.status === "completed" || taskToClaim.status === "deleted") {
						return {
							details: {},
							content: [{ type: "text", text: `Cannot claim #${taskToClaim.id}: already ${taskToClaim.status}` }],
						};
					}

					// Already claimed by someone else
					if (taskToClaim.owner && taskToClaim.owner !== params.owner) {
						return {
							details: {},
							content: [
								{
									type: "text",
									text: `Cannot claim #${taskToClaim.id}: already owned by ${taskToClaim.owner}`,
								},
							],
						};
					}

					// Busy-check: agent can't claim if they already own an in_progress task
					const busyTask = state.tasks.find(
						(t) => t.owner === params.owner && t.status === "in_progress" && t.id !== taskToClaim.id
					);
					if (busyTask) {
						return {
							details: {},
							content: [
								{
									type: "text",
									text: `Cannot claim #${taskToClaim.id}: ${params.owner} is busy with #${busyTask.id} (${busyTask.subject})`,
								},
							],
						};
					}

					// Check blockedBy deps
					const unmetDeps = taskToClaim.blockedBy.filter((depId) => {
						const dep = state.tasks.find((t) => t.id === depId);
						return dep && dep.status !== "completed";
					});
					if (unmetDeps.length > 0) {
						return {
							details: {},
							content: [
								{ type: "text", text: `Cannot claim #${taskToClaim.id}: blocked by tasks ${unmetDeps.join(", ")}` },
							],
						};
					}

					// Claim successful — set owner and move to in_progress
					taskToClaim.owner = params.owner;
					updateTaskStatus(taskToClaim.id, "in_progress");
					persistTask(taskToClaim);
					updateWidget(ctx);
					persistState();
					return {
						details: {},
						content: [
							{ type: "text", text: `Claimed #${taskToClaim.id}: ${taskToClaim.subject} (owner: ${params.owner})` },
						],
					};
				}
				default:
					return { details: {}, content: [{ type: "text", text: `Unknown action: ${params.action}` }] };
			}
		},
	});

	// Auto-extract tasks from assistant messages
	pi.on("turn_end", async (event, ctx) => {
		if (!isAssistantMessage(event.message)) return;

		turnsSinceLastTaskTool++;
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

		const pending = state.tasks.filter((t) => t.status !== "completed" && t.status !== "deleted");
		if (pending.length === 0) return;

		const taskList = pending
			.map((t) => {
				const status = t.status === "in_progress" ? " [IN PROGRESS]" : "";
				const blocked = t.blockedBy.length > 0 ? ` [blocked by: ${t.blockedBy.join(", ")}]` : "";
				const desc = t.description ? `\n   ${t.description}` : "";
				const lastComment = t.comments.length > 0 ? `\n   💬 ${t.comments.at(-1)?.content}` : "";
				return `${t.id}. ${t.subject}${status}${blocked}${desc}${lastComment}`;
			})
			.join("\n");

		const activeTask = state.tasks.find((t) => t.id === state.activeTaskId);
		const focusText = activeTask ? `\nCurrent focus: ${activeTask.subject}` : "";

		// Gentle reminder if manage_tasks hasn't been used in a while
		const reminder =
			turnsSinceLastTaskTool >= REMINDER_TURN_THRESHOLD
				? "\n\n[Reminder] The manage_tasks tool hasn't been used recently. Update task progress, mark completed tasks, or clean up stale items."
				: "";

		return {
			message: {
				customType: "tasks-context",
				content: `[ACTIVE TASKS]
${taskList}
${focusText}

When you complete a task, mark it with [DONE] or include "completed:" followed by the task description.${reminder}`,
				display: false,
			},
		};
	});

	// Interval for updating background subagents/tasks display (main process only)
	const G = globalThis;
	if (!isSubagent && G.__piTasksInterval) {
		clearInterval(G.__piTasksInterval);
	}
	let lastBgCount = 0;
	let lastBgTaskCount = 0;

	// Restore state on session start
	pi.on("session_start", async (_event, ctx) => {
		// Restore meta state (visibility, nextId) from session entries
		const entries = ctx.sessionManager.getEntries();
		const stateEntry = entries
			.filter((e: { type: string; customType?: string }) => e.type === "custom" && e.customType === "tasks-state")
			.pop() as { data?: Omit<Partial<TasksState>, "tasks"> & { tasks?: Record<string, unknown>[] } } | undefined;

		if (stateEntry?.data) {
			state.visible = stateEntry.data.visible ?? true;
			state.nextId = stateEntry.data.nextId ?? 1;
			state.activeTaskId = stateEntry.data.activeTaskId ?? null;
		}

		// Load tasks: prefer file store (shared mode), fall back to session entries
		if (store.isShared) {
			loadFromStore();

			// Start watching for cross-session changes
			store.watch(() => {
				loadFromStore();
				updateWidget(ctx);
			});
		} else if (stateEntry?.data?.tasks) {
			// Session-only mode: restore from entries, migrating old schema
			state.tasks = stateEntry.data.tasks.map((t) => ({
				id: (t.id as string) ?? String(state.nextId++),
				subject: (t.subject as string) ?? (t.title as string) ?? "Untitled",
				description: t.description as string | undefined,
				activeForm: t.activeForm as string | undefined,
				status: (t.status as TaskStatus) ?? "pending",
				blocks: (t.blocks as string[]) ?? [],
				blockedBy: (t.blockedBy as string[]) ?? (t.dependencies as string[]) ?? [],
				comments: (t.comments as TaskComment[]) ?? [],
				owner: t.owner as string | undefined,
				metadata: t.metadata as Record<string, unknown> | undefined,
				createdAt: (t.createdAt as number) ?? Date.now(),
				completedAt: t.completedAt as number | undefined,
			}));
			// Recalculate nextId
			const maxId = state.tasks.reduce((max, t) => Math.max(max, Number(t.id) || 0), 0);
			state.nextId = Math.max(state.nextId, maxId + 1);
		}

		updateWidget(ctx);

		// Start interval to animate subagents and background tasks (main process only)
		if (!isSubagent) {
			if (G.__piTasksInterval) clearInterval(G.__piTasksInterval);
			G.__piTasksInterval = setInterval(() => {
				const fgSubagents = globalThis.__piRunningSubagents;
				const bgSubagents = globalThis.__piBackgroundSubagents;
				const bgTasks = globalThis.__piBackgroundTasks;

				const fgRunning = fgSubagents ? fgSubagents.size : 0;
				const bgRunning = bgSubagents
					? ([...bgSubagents.values()] as unknown as SubagentView[]).filter((s) => s.status === "running").length
					: 0;
				const bgTaskRunning = bgTasks
					? ([...bgTasks.values()] as unknown as BgTaskView[]).filter((t) => t.status === "running").length
					: 0;
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
			// Track live subagent activity via event bus
			pi.events.on("subagent_tool_call", (raw: unknown) => {
				const data = raw as Record<string, unknown>;
				const agentId = String(data.agent_id ?? "");
				const toolName = String(data.tool_name ?? "");
				const toolInput = (data.tool_input ?? {}) as Record<string, unknown>;
				if (agentId) {
					agentActivity.set(agentId, {
						toolName,
						summary: summarizeToolCall(toolName, toolInput),
						timestamp: Date.now(),
					});
				}
			});

			pi.events.on("subagent_tool_result", (raw: unknown) => {
				const data = raw as Record<string, unknown>;
				const agentId = String(data.agent_id ?? "");
				if (agentId) {
					// Clear activity — agent is between tool calls (thinking)
					agentActivity.set(agentId, {
						toolName: "",
						summary: "Thinking...",
						timestamp: Date.now(),
					});
				}
			});

			pi.events.on("subagent_stop", (raw: unknown) => {
				const data = raw as Record<string, unknown>;
				const agentId = String(data.agent_id ?? "");
				if (agentId) {
					agentActivity.delete(agentId);
				}
			});
		} // end !isSubagent interval guard
	});

	// Cleanup on session end
	pi.on("session_shutdown", async () => {
		store.close();
		persistState();
	});
}
