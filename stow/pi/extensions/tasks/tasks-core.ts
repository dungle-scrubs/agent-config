/**
 * Core tasks logic - extracted for testability.
 * Provides state management for task lists with progress tracking.
 */

/** Status of a task */
export type TaskStatus = "pending" | "in_progress" | "completed";

/** A single task in the task list */
export interface Task {
	id: string;
	title: string;
	status: TaskStatus;
	dependencies: string[];
	createdAt: number;
	completedAt?: number;
}

/** State container for the tasks system */
export interface TasksState {
	tasks: Task[];
	visible: boolean;
	activeTaskId: string | null;
}

/**
 * Creates the initial empty tasks state.
 * @returns A fresh TasksState object
 */
export function createInitialState(): TasksState {
	return {
		tasks: [],
		visible: true,
		activeTaskId: null,
	};
}

/**
 * Generates a unique task ID.
 * @returns A unique string identifier for a task
 */
export function generateTaskId(): string {
	return `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Adds a single task to the state.
 * @param state - The tasks state to modify
 * @param title - Title of the new task
 * @param dependencies - Optional array of task IDs this task depends on
 * @returns The newly created task
 */
export function addTask(state: TasksState, title: string, dependencies: string[] = []): Task {
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

/**
 * Adds multiple tasks at once atomically.
 * Auto-starts the first task if the list was empty.
 * @param state - The tasks state to modify
 * @param titles - Array of task titles to add
 * @returns Array of newly created tasks
 */
export function addTasksBatch(state: TasksState, titles: string[]): Task[] {
	// ATOMIC: Build new task list without intermediate empty state
	const pendingTasks = state.tasks.filter((t) => t.status !== "completed");
	const wasEmpty = pendingTasks.length === 0;

	const newTasks: Task[] = [];
	for (const title of titles) {
		const task: Task = {
			id: generateTaskId(),
			title,
			status: "pending",
			dependencies: [],
			createdAt: Date.now(),
		};
		newTasks.push(task);
	}

	// Single atomic assignment - never exposes empty state
	state.tasks = [...pendingTasks, ...newTasks];

	// Auto-start first task if list was empty
	if (wasEmpty && state.tasks.length > 0) {
		state.tasks[0].status = "in_progress";
		state.activeTaskId = state.tasks[0].id;
	}

	return newTasks;
}

/**
 * Marks a task as completed by its 1-indexed position.
 * Automatically starts the next pending task.
 * @param state - The tasks state to modify
 * @param index - 1-indexed position of the task to complete
 * @returns The completed task or null if index is invalid
 */
export function completeTask(state: TasksState, index: number): Task | null {
	const idx = index - 1; // 1-indexed
	if (idx < 0 || idx >= state.tasks.length) return null;

	const task = state.tasks[idx];
	task.status = "completed";
	task.completedAt = Date.now();

	// Start next pending task
	const nextPending = state.tasks.find((t) => t.status === "pending");
	if (nextPending) {
		nextPending.status = "in_progress";
		state.activeTaskId = nextPending.id;
	} else {
		state.activeTaskId = null;
	}

	return task;
}

/**
 * Marks multiple tasks as completed at once.
 * Automatically starts the next pending task after all completions.
 * @param state - The tasks state to modify
 * @param indices - Array of 1-indexed positions to complete
 * @returns Array of tasks that were completed
 */
export function completeTasksBatch(state: TasksState, indices: number[]): Task[] {
	const completed: Task[] = [];
	for (const i of indices) {
		const idx = i - 1;
		if (idx >= 0 && idx < state.tasks.length) {
			const task = state.tasks[idx];
			if (task.status !== "completed") {
				task.status = "completed";
				task.completedAt = Date.now();
				completed.push(task);
			}
		}
	}

	// Start next pending task
	const nextPending = state.tasks.find((t) => t.status === "pending");
	if (nextPending) {
		nextPending.status = "in_progress";
		state.activeTaskId = nextPending.id;
	} else {
		state.activeTaskId = null;
	}

	return completed;
}

/**
 * Clears all tasks from the state.
 * @param state - The tasks state to modify
 * @returns The number of tasks that were cleared
 */
export function clearTasks(state: TasksState): number {
	const count = state.tasks.length;
	state.tasks = [];
	state.activeTaskId = null;
	return count;
}

/**
 * Checks if all tasks in the state are completed.
 * @param state - The tasks state to check
 * @returns true if there are tasks and all are completed
 */
export function allTasksCompleted(state: TasksState): boolean {
	return state.tasks.length > 0 && state.tasks.every((t) => t.status === "completed");
}

/** Represents a background subagent task */
export interface BackgroundSubagent {
	id: string;
	agent: string;
	task: string;
	startTime: number;
	status: "running" | "completed" | "failed";
}

/**
 * Formats a duration in milliseconds to a human-readable string.
 * @param ms - Duration in milliseconds
 * @returns Formatted string like "5s" or "2m30s"
 */
export function formatDuration(ms: number): string {
	const secs = Math.floor(ms / 1000);
	if (secs < 60) return `${secs}s`;
	const mins = Math.floor(secs / 60);
	return `${mins}m${secs % 60}s`;
}

/**
 * Builds the widget display lines for the tasks UI.
 * @param state - Current tasks state
 * @param bgSubagents - Array of background subagents to display
 * @param theme - Theme object with fg() and strikethrough() methods
 * @returns Array of formatted lines for the widget
 */
export function buildWidgetLines(
	state: TasksState,
	bgSubagents: BackgroundSubagent[],
	theme: { fg: (color: string, text: string) => string; strikethrough: (text: string) => string }
): string[] {
	const lines: string[] = [];

	if (!state.visible || state.tasks.length === 0) {
		return lines;
	}

	const completed = state.tasks.filter((t) => t.status === "completed").length;
	lines.push(theme.fg("accent", `Tasks (${completed}/${state.tasks.length})`));

	const maxVisible = Math.min(10, state.tasks.length);
	const visibleTasks = state.tasks.slice(0, maxVisible);

	for (let i = 0; i < visibleTasks.length; i++) {
		const task = visibleTasks[i];
		const isLast = i === visibleTasks.length - 1 && state.tasks.length <= maxVisible;
		const treeChar = isLast ? "└─" : "├─";
		let icon: string;
		let text: string;

		switch (task.status) {
			case "completed":
				icon = theme.fg("success", "✓");
				text = theme.fg("muted", theme.strikethrough(task.title));
				break;
			case "in_progress":
				icon = theme.fg("warning", "▣");
				text = theme.fg("accent", task.title);
				break;
			default:
				icon = "☐";
				text = task.title;
		}

		const maxLen = 50;
		const _title = task.title.length > maxLen ? `${task.title.substring(0, maxLen - 3)}...` : task.title;

		lines.push(`${theme.fg("muted", treeChar)} ${icon} ${text}`);
	}

	if (state.tasks.length > maxVisible) {
		lines.push(theme.fg("muted", `└─ ... and ${state.tasks.length - maxVisible} more`));
	}

	// Background subagents
	const bgRunning = bgSubagents.filter((s) => s.status === "running");
	if (bgRunning.length > 0) {
		lines.push(""); // Spacer
		lines.push(`${theme.fg("accent", "Background Subagents")} ${theme.fg("success", `● ${bgRunning.length} running`)}`);

		for (let i = 0; i < bgRunning.length; i++) {
			const sub = bgRunning[i];
			const isLast = i === bgRunning.length - 1;
			const treeChar = isLast ? "└─" : "├─";
			const duration = formatDuration(Date.now() - sub.startTime);
			const taskPreview = sub.task.length > 35 ? `${sub.task.slice(0, 32)}...` : sub.task;
			lines.push(
				theme.fg("accent", treeChar) +
					" " +
					theme.fg("success", sub.agent) +
					": " +
					theme.fg("dim", taskPreview) +
					" " +
					theme.fg("muted", `(${duration})`)
			);
		}
	}

	return lines;
}
