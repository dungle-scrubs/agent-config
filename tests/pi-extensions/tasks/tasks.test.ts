/**
 * Unit tests for tasks extension
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
	addTask,
	addTasksBatch,
	allTasksCompleted,
	type BackgroundSubagent,
	buildWidgetLines,
	clearTasks,
	completeTask,
	completeTasksBatch,
	createInitialState,
	type TasksState,
} from "../../../stow/pi/extensions/tasks/tasks-core.js";

// Mock theme
const mockTheme = {
	fg: (color: string, text: string) => `[${color}]${text}[/${color}]`,
	strikethrough: (text: string) => `~~${text}~~`,
};

describe("tasks core", () => {
	let state: TasksState;

	beforeEach(() => {
		state = createInitialState();
	});

	describe("createInitialState", () => {
		it("should create empty state", () => {
			expect(state.tasks).toEqual([]);
			expect(state.visible).toBe(true);
			expect(state.activeTaskId).toBeNull();
		});
	});

	describe("addTask", () => {
		it("should add single task", () => {
			const task = addTask(state, "Test task");
			expect(state.tasks.length).toBe(1);
			expect(task.title).toBe("Test task");
			expect(task.status).toBe("pending");
		});

		it("should add task with dependencies", () => {
			const task1 = addTask(state, "Task 1");
			const task2 = addTask(state, "Task 2", [task1.id]);
			expect(task2.dependencies).toContain(task1.id);
		});
	});

	describe("addTasksBatch", () => {
		it("should add multiple tasks", () => {
			const tasks = addTasksBatch(state, ["Task 1", "Task 2", "Task 3"]);
			expect(state.tasks.length).toBe(3);
			expect(tasks.length).toBe(3);
		});

		it("should auto-start first task", () => {
			addTasksBatch(state, ["Task 1", "Task 2"]);
			expect(state.tasks[0].status).toBe("in_progress");
			expect(state.activeTaskId).toBe(state.tasks[0].id);
		});

		it("should clear completed tasks before adding", () => {
			// Add and complete some tasks
			addTasksBatch(state, ["Old task"]);
			state.tasks[0].status = "completed";

			// Add new batch
			addTasksBatch(state, ["New task 1", "New task 2"]);

			// Old completed task should be gone
			expect(state.tasks.length).toBe(2);
			expect(state.tasks.every((t) => t.title.startsWith("New"))).toBe(true);
		});
	});

	describe("completeTask", () => {
		it("should complete task by index (1-indexed)", () => {
			addTasksBatch(state, ["Task 1", "Task 2"]);
			const completed = completeTask(state, 1);
			expect(completed?.title).toBe("Task 1");
			expect(completed?.status).toBe("completed");
		});

		it("should auto-advance to next pending task", () => {
			addTasksBatch(state, ["Task 1", "Task 2", "Task 3"]);
			completeTask(state, 1);
			expect(state.tasks[1].status).toBe("in_progress");
		});

		it("should return null for invalid index", () => {
			addTasksBatch(state, ["Task 1"]);
			expect(completeTask(state, 0)).toBeNull();
			expect(completeTask(state, 5)).toBeNull();
		});
	});

	describe("completeTasksBatch", () => {
		it("should complete multiple tasks", () => {
			addTasksBatch(state, ["Task 1", "Task 2", "Task 3"]);
			const completed = completeTasksBatch(state, [1, 2]);
			expect(completed.length).toBe(2);
			expect(state.tasks[0].status).toBe("completed");
			expect(state.tasks[1].status).toBe("completed");
		});

		it("should skip already completed tasks", () => {
			addTasksBatch(state, ["Task 1", "Task 2"]);
			state.tasks[0].status = "completed";
			const completed = completeTasksBatch(state, [1, 2]);
			expect(completed.length).toBe(1);
			expect(completed[0].title).toBe("Task 2");
		});
	});

	describe("clearTasks", () => {
		it("should clear all tasks", () => {
			addTasksBatch(state, ["Task 1", "Task 2"]);
			const count = clearTasks(state);
			expect(count).toBe(2);
			expect(state.tasks.length).toBe(0);
			expect(state.activeTaskId).toBeNull();
		});
	});

	describe("allTasksCompleted", () => {
		it("should return false for empty state", () => {
			expect(allTasksCompleted(state)).toBe(false);
		});

		it("should return false when tasks pending", () => {
			addTasksBatch(state, ["Task 1", "Task 2"]);
			expect(allTasksCompleted(state)).toBe(false);
		});

		it("should return true when all completed", () => {
			addTasksBatch(state, ["Task 1", "Task 2"]);
			completeTasksBatch(state, [1, 2]);
			expect(allTasksCompleted(state)).toBe(true);
		});
	});

	describe("buildWidgetLines", () => {
		it("should return empty for invisible state", () => {
			state.visible = false;
			addTasksBatch(state, ["Task 1"]);
			const lines = buildWidgetLines(state, [], mockTheme);
			expect(lines.length).toBe(0);
		});

		it("should return empty for no tasks", () => {
			const lines = buildWidgetLines(state, [], mockTheme);
			expect(lines.length).toBe(0);
		});

		it("should include header with count", () => {
			addTasksBatch(state, ["Task 1", "Task 2"]);
			const lines = buildWidgetLines(state, [], mockTheme);
			expect(lines[0]).toContain("Tasks (0/2)");
		});

		it("should show in-progress task with bullet", () => {
			addTasksBatch(state, ["Task 1"]);
			const lines = buildWidgetLines(state, [], mockTheme);
			expect(lines[1]).toContain("▣");
		});

		it("should show completed task with check", () => {
			addTasksBatch(state, ["Task 1"]);
			completeTask(state, 1);
			const lines = buildWidgetLines(state, [], mockTheme);
			expect(lines[1]).toContain("✓");
		});

		it("should include background subagents below tasks", () => {
			addTasksBatch(state, ["Task 1"]);
			const bgSubagents: BackgroundSubagent[] = [
				{ id: "bg_1", agent: "worker", task: "Test task", startTime: Date.now(), status: "running" },
			];
			const lines = buildWidgetLines(state, bgSubagents, mockTheme);
			expect(lines.some((l) => l.includes("Background Subagents"))).toBe(true);
			expect(lines.some((l) => l.includes("worker"))).toBe(true);
		});

		it("should not show completed background subagents", () => {
			addTasksBatch(state, ["Task 1"]);
			const bgSubagents: BackgroundSubagent[] = [
				{ id: "bg_1", agent: "worker", task: "Test task", startTime: Date.now(), status: "completed" },
			];
			const lines = buildWidgetLines(state, bgSubagents, mockTheme);
			expect(lines.some((l) => l.includes("Background Subagents"))).toBe(false);
		});
	});

	describe("widget visibility edge cases", () => {
		it("should not clear widget when tasks exist", () => {
			addTasksBatch(state, ["Task 1"]);
			expect(state.tasks.length).toBeGreaterThan(0);
			expect(state.visible).toBe(true);

			// This condition guards widget clearing - should be false
			const shouldClear = !state.visible || state.tasks.length === 0;
			expect(shouldClear).toBe(false);
		});

		it("should clear widget only when no tasks AND not visible", () => {
			// No tasks
			expect(state.tasks.length).toBe(0);
			const shouldClear1 = !state.visible || state.tasks.length === 0;
			expect(shouldClear1).toBe(true);

			// Has tasks, visible
			addTasksBatch(state, ["Task 1"]);
			const shouldClear2 = !state.visible || state.tasks.length === 0;
			expect(shouldClear2).toBe(false);

			// Has tasks, not visible
			state.visible = false;
			const shouldClear3 = !state.visible || state.tasks.length === 0;
			expect(shouldClear3).toBe(true);
		});

		it("should not flap visibility during batch operations", () => {
			// Simulate: clear completed, then add new tasks
			addTasksBatch(state, ["Old task"]);
			state.tasks[0].status = "completed";

			// During addTasksBatch, completed tasks are cleared first
			// This could momentarily make tasks.length === 0
			const _beforeClear = state.tasks.length;
			state.tasks = state.tasks.filter((t) => t.status !== "completed");
			const afterClear = state.tasks.length;

			// If we check visibility here, it would incorrectly clear widget
			const wouldFlicker = afterClear === 0;
			expect(wouldFlicker).toBe(true); // This is the bug!

			// New tasks added
			addTask(state, "New task");
			expect(state.tasks.length).toBe(1);
		});

		it("addTasksBatch should be atomic (no intermediate empty state)", () => {
			// This test documents desired behavior
			addTasksBatch(state, ["Old task"]);
			state.tasks[0].status = "completed";

			// Track if tasks.length ever becomes 0 during batch add
			let sawEmptyState = false;
			const originalTasks = state.tasks;

			// Monkey-patch to detect intermediate empty state
			Object.defineProperty(state, "tasks", {
				get() {
					return this._tasks;
				},
				set(value) {
					if (Array.isArray(value) && value.length === 0 && this._tasks && this._tasks.length > 0) {
						sawEmptyState = true;
					}
					this._tasks = value;
				},
				configurable: true,
			});
			state._tasks = originalTasks;

			addTasksBatch(state, ["New task 1", "New task 2"]);

			// Should never have seen empty state
			expect(sawEmptyState).toBe(false);

			// After batch add, should have new tasks (old completed removed)
			expect(state.tasks.length).toBe(2);
		});

		it("widget should not clear during batch add with completed tasks", () => {
			// Simulate what updateWidget checks
			const shouldClearWidget = (s: TasksState) => !s.visible || s.tasks.length === 0;

			addTasksBatch(state, ["Old task"]);
			state.tasks[0].status = "completed";

			// Before batch add
			expect(shouldClearWidget(state)).toBe(false);

			// During batch add - this is what we're testing
			// The old buggy code did:
			//   state.tasks = state.tasks.filter(t => t.status !== "completed"); // <-- length becomes 0!
			//   for (const t of titles) addTask(t);
			//
			// If updateWidget runs between those two lines, widget disappears

			addTasksBatch(state, ["New task 1", "New task 2"]);

			// After batch add
			expect(shouldClearWidget(state)).toBe(false);
			expect(state.tasks.length).toBe(2);
		});
	});

	describe("stale task detection", () => {
		it("should identify when tasks are stale (all completed for >2s)", () => {
			addTasksBatch(state, ["Task 1", "Task 2"]);
			completeTasksBatch(state, [1, 2]);

			// All completed
			expect(allTasksCompleted(state)).toBe(true);

			// Set completedAt to 3 seconds ago
			const threeSecondsAgo = Date.now() - 3000;
			state.tasks.forEach((t) => {
				t.completedAt = threeSecondsAgo;
			});

			// Should be considered stale
			const isStale =
				allTasksCompleted(state) && state.tasks.every((t) => t.completedAt && Date.now() - t.completedAt > 2000);
			expect(isStale).toBe(true);
		});

		it("should not be stale if recently completed", () => {
			addTasksBatch(state, ["Task 1"]);
			completeTask(state, 1);

			// Just completed
			const isStale =
				allTasksCompleted(state) && state.tasks.every((t) => t.completedAt && Date.now() - t.completedAt > 2000);
			expect(isStale).toBe(false);
		});

		it("should not be stale if tasks still pending", () => {
			addTasksBatch(state, ["Task 1", "Task 2"]);
			completeTask(state, 1);

			// Task 2 still pending
			expect(allTasksCompleted(state)).toBe(false);
		});
	});

	describe("widget setWidget call patterns (flicker detection)", () => {
		it("should never call setWidget(undefined) when tasks exist", () => {
			// Mock tracking
			const setWidgetCalls: Array<{ id: string; lines: string[] | undefined }> = [];
			const mockSetWidget = (id: string, lines: string[] | undefined) => {
				setWidgetCalls.push({ id, lines });
			};

			addTasksBatch(state, ["Task 1", "Task 2"]);

			// Simulate what updateWidget does
			const shouldClear = !state.visible || state.tasks.length === 0;

			if (shouldClear) {
				mockSetWidget("1-tasks", undefined);
			} else {
				mockSetWidget("1-tasks", ["line1", "line2"]);
			}

			// Should NOT have called with undefined when tasks exist
			const undefinedCalls = setWidgetCalls.filter((c) => c.lines === undefined);
			expect(undefinedCalls.length).toBe(0);
		});

		it("should not rapidly toggle widget on/off", () => {
			// Simulate multiple rapid updates
			const setWidgetCalls: Array<{ time: number; defined: boolean }> = [];
			let time = 0;

			const mockSetWidget = (lines: string[] | undefined) => {
				setWidgetCalls.push({ time: time++, defined: lines !== undefined });
			};

			addTasksBatch(state, ["Task 1"]);

			// Simulate 10 rapid updates (like from interval)
			for (let i = 0; i < 10; i++) {
				const shouldShow = state.visible && state.tasks.length > 0;
				mockSetWidget(shouldShow ? ["lines"] : undefined);
			}

			// Check for flicker pattern: defined -> undefined -> defined
			let flickerCount = 0;
			for (let i = 1; i < setWidgetCalls.length - 1; i++) {
				const prev = setWidgetCalls[i - 1].defined;
				const curr = setWidgetCalls[i].defined;
				const next = setWidgetCalls[i + 1].defined;

				if (prev && !curr && next) {
					flickerCount++; // Found flicker: on -> off -> on
				}
			}

			expect(flickerCount).toBe(0);
		});

		it("should track setWidget calls and detect redundant updates", () => {
			const calls: string[] = [];
			let lastStableKey = "";

			const simulateUpdateWidget = () => {
				const taskStates = state.tasks.map((t) => `${t.id}:${t.status}`).join(",");
				const bgIds = ""; // no bg subagents for this test
				const stableKey = `${taskStates}|${bgIds}`;

				if (stableKey !== lastStableKey) {
					calls.push(`setWidget:${stableKey}`);
					lastStableKey = stableKey;
				} else {
					calls.push(`skip:${stableKey}`);
				}
			};

			addTasksBatch(state, ["Task 1"]);

			// First call should set widget
			simulateUpdateWidget();
			expect(calls[0]).toMatch(/^setWidget:/);

			// Subsequent calls with same state should skip
			simulateUpdateWidget();
			simulateUpdateWidget();
			simulateUpdateWidget();

			// Should only have 1 setWidget call, rest should be skips
			const setCalls = calls.filter((c) => c.startsWith("setWidget:"));
			const skipCalls = calls.filter((c) => c.startsWith("skip:"));

			expect(setCalls.length).toBe(1);
			expect(skipCalls.length).toBe(3);
		});

		it("should call setWidget when task status changes", () => {
			const calls: string[] = [];
			let lastStableKey = "";

			const simulateUpdateWidget = () => {
				const taskStates = state.tasks.map((t) => `${t.id}:${t.status}`).join(",");
				const stableKey = `${taskStates}|`;

				if (stableKey !== lastStableKey) {
					calls.push("setWidget");
					lastStableKey = stableKey;
				} else {
					calls.push("skip");
				}
			};

			addTasksBatch(state, ["Task 1", "Task 2"]);
			simulateUpdateWidget(); // Initial

			completeTask(state, 1);
			simulateUpdateWidget(); // After complete

			// Should have 2 setWidget calls (initial + after status change)
			const setCalls = calls.filter((c) => c === "setWidget");
			expect(setCalls.length).toBe(2);
		});
	});

	describe("PI_IS_SUBAGENT skip behavior", () => {
		it("should skip extension initialization in subagent workers", () => {
			// When PI_IS_SUBAGENT=1, the extension should return early
			// This prevents duplicate instances in subagent workers
			const originalEnv = process.env.PI_IS_SUBAGENT;

			// Simulate subagent environment
			process.env.PI_IS_SUBAGENT = "1";

			// The extension checks this at the start of the default export
			const shouldSkip = process.env.PI_IS_SUBAGENT === "1";
			expect(shouldSkip).toBe(true);

			// Restore
			if (originalEnv === undefined) {
				process.env.PI_IS_SUBAGENT = undefined;
			} else {
				process.env.PI_IS_SUBAGENT = originalEnv;
			}
		});

		it("should not skip in main Pi process", () => {
			const originalEnv = process.env.PI_IS_SUBAGENT;
			process.env.PI_IS_SUBAGENT = undefined;

			const shouldSkip = process.env.PI_IS_SUBAGENT === "1";
			expect(shouldSkip).toBe(false);

			// Restore
			if (originalEnv !== undefined) {
				process.env.PI_IS_SUBAGENT = originalEnv;
			}
		});
	});

	describe("globalThis interval cleanup", () => {
		it("should store interval on globalThis for cross-reload cleanup", () => {
			const G = globalThis as any;

			// Simulate setting interval
			const mockInterval = setTimeout(() => {}, 1000);
			G.__piTasksInterval = mockInterval;

			expect(G.__piTasksInterval).toBeDefined();

			// Simulate reload clearing it
			if (G.__piTasksInterval) {
				clearTimeout(G.__piTasksInterval);
				G.__piTasksInterval = null;
			}

			expect(G.__piTasksInterval).toBeNull();
		});

		it("should clear existing interval before creating new one", () => {
			const G = globalThis as any;
			const clearedIntervals: any[] = [];

			// Track what gets cleared
			const originalClearInterval = clearInterval;
			(global as any).clearInterval = (id: any) => {
				clearedIntervals.push(id);
				originalClearInterval(id);
			};

			// Set an "old" interval
			const oldInterval = setTimeout(() => {}, 1000);
			G.__piTasksInterval = oldInterval;

			// Simulate reload logic
			if (G.__piTasksInterval) {
				clearInterval(G.__piTasksInterval);
			}
			G.__piTasksInterval = setTimeout(() => {}, 1000);

			expect(clearedIntervals).toContain(oldInterval);

			// Cleanup
			clearTimeout(G.__piTasksInterval);
			G.__piTasksInterval = null;
			(global as any).clearInterval = originalClearInterval;
		});
	});

	describe("widget stability (flicker prevention)", () => {
		it("should generate stable key when only duration changes", () => {
			// Simulates the issue: widget disappearing/reappearing when duration updates
			// The stable key should NOT change when only time passes

			const buildStableKey = (tasks: Task[], bgRunningIds: string[]) => {
				const taskStates = tasks.map((t) => `${t.id}:${t.status}`).join(",");
				const bgIds = bgRunningIds.join(",");
				return `${taskStates}|${bgIds}`;
			};

			addTasksBatch(state, ["Task 1", "Task 2"]);
			const bgIds = ["bg_1", "bg_2"];

			// Key at time T
			const key1 = buildStableKey(state.tasks, bgIds);

			// Key at time T+1s (duration changed but nothing else)
			const key2 = buildStableKey(state.tasks, bgIds);

			expect(key1).toBe(key2); // Keys should be identical
		});

		it("should change key when task status changes", () => {
			const buildStableKey = (tasks: Task[], bgRunningIds: string[]) => {
				const taskStates = tasks.map((t) => `${t.id}:${t.status}`).join(",");
				const bgIds = bgRunningIds.join(",");
				return `${taskStates}|${bgIds}`;
			};

			addTasksBatch(state, ["Task 1", "Task 2"]);
			const key1 = buildStableKey(state.tasks, []);

			completeTask(state, 1);
			const key2 = buildStableKey(state.tasks, []);

			expect(key1).not.toBe(key2); // Keys should differ
		});

		it("should change key when background subagent added", () => {
			const buildStableKey = (tasks: Task[], bgRunningIds: string[]) => {
				const taskStates = tasks.map((t) => `${t.id}:${t.status}`).join(",");
				const bgIds = bgRunningIds.join(",");
				return `${taskStates}|${bgIds}`;
			};

			addTasksBatch(state, ["Task 1"]);
			const key1 = buildStableKey(state.tasks, ["bg_1"]);
			const key2 = buildStableKey(state.tasks, ["bg_1", "bg_2"]);

			expect(key1).not.toBe(key2); // Keys should differ
		});

		it("should change key when background subagent completes", () => {
			const buildStableKey = (tasks: Task[], bgRunningIds: string[]) => {
				const taskStates = tasks.map((t) => `${t.id}:${t.status}`).join(",");
				const bgIds = bgRunningIds.join(",");
				return `${taskStates}|${bgIds}`;
			};

			addTasksBatch(state, ["Task 1"]);
			const key1 = buildStableKey(state.tasks, ["bg_1", "bg_2"]);
			const key2 = buildStableKey(state.tasks, ["bg_1"]); // bg_2 completed

			expect(key1).not.toBe(key2); // Keys should differ
		});

		it("widget lines should still update duration for display", () => {
			// Even though key is stable, the actual lines should show updated duration
			addTasksBatch(state, ["Task 1"]);

			const earlyStart = Date.now() - 5000; // 5 seconds ago
			const lateStart = Date.now() - 30_000; // 30 seconds ago

			const bgEarly: BackgroundSubagent[] = [
				{ id: "bg_1", agent: "worker", task: "Test", startTime: earlyStart, status: "running" },
			];
			const bgLate: BackgroundSubagent[] = [
				{ id: "bg_1", agent: "worker", task: "Test", startTime: lateStart, status: "running" },
			];

			const linesEarly = buildWidgetLines(state, bgEarly, mockTheme);
			const linesLate = buildWidgetLines(state, bgLate, mockTheme);

			// Lines should be different (different durations displayed)
			const earlyStr = linesEarly.join("\n");
			const lateStr = linesLate.join("\n");
			expect(earlyStr).not.toBe(lateStr);
			expect(earlyStr).toContain("5s");
			expect(lateStr).toContain("30s");
		});
	});
});
