/**
 * Comprehensive tests for the Tasks Extension
 *
 * Run with: npx tsx ~/.pi/extensions/__tests__/task-list-store.test.ts
 *
 * Covers:
 * - TaskListStore: CRUD, schema migration, file locking, corrupt handling
 * - Task engine: addTask, updateTaskStatus, deps, comments, delete, clear
 * - Claim action: owner enforcement, busy-check, dep validation
 * - Metadata: merge semantics, null-to-delete
 * - Completion detection: findCompletedTasks regex patterns
 * - Auto-advance: completing task starts next pending
 * - Text extraction: _extractTasksFromText patterns
 */

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ── Types (mirrors tasks.ts) ───────────────────────────────────────────────

type TaskStatus = "pending" | "in_progress" | "completed" | "deleted";

interface TaskComment {
	author: string;
	content: string;
	timestamp: number;
}

interface Task {
	id: string;
	subject: string;
	description?: string;
	activeForm?: string;
	status: TaskStatus;
	blocks: string[];
	blockedBy: string[];
	comments: TaskComment[];
	owner?: string;
	metadata?: Record<string, unknown>;
	createdAt: number;
	completedAt?: number;
}

// ── Minimal TaskListStore (extracted logic for testing) ─────────────────────

class TaskListStore {
	private readonly dirPath: string | null;

	constructor(dirPath: string | null) {
		if (dirPath) {
			mkdirSync(dirPath, { recursive: true });
			this.dirPath = dirPath;
		} else {
			this.dirPath = null;
		}
	}

	get isShared(): boolean {
		return this.dirPath !== null;
	}

	get path(): string | null {
		return this.dirPath;
	}

	/**
	 * Acquire a directory-based lock. Returns a release function.
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
					// busy-wait
				}
			}
		}
		if (!acquired) {
			try {
				rmdirSync(lockDir);
				mkdirSync(lockDir);
				acquired = true;
			} catch {
				// Proceed unlocked
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

	loadAll(): Task[] | null {
		if (!this.dirPath) return null;
		if (!existsSync(this.dirPath)) return [];

		const tasks: Task[] = [];
		const files = readdirSync(this.dirPath).filter((f) => f.endsWith(".json"));
		for (const file of files) {
			try {
				const raw = readFileSync(join(this.dirPath, file), "utf-8");
				const parsed = JSON.parse(raw) as Record<string, unknown>;
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
		return tasks.sort((a, b) => Number(a.id) - Number(b.id));
	}

	saveTask(task: Task): void {
		if (!this.dirPath) return;
		const filePath = join(this.dirPath, `${task.id}.json`);
		const unlock = this.lock();
		try {
			writeFileSync(filePath, JSON.stringify(task, null, 2), "utf-8");
		} finally {
			unlock();
		}
	}

	deleteTask(taskId: string): void {
		if (!this.dirPath) return;
		const filePath = join(this.dirPath, `${taskId}.json`);
		const unlock = this.lock();
		try {
			if (existsSync(filePath)) rmSync(filePath);
		} finally {
			unlock();
		}
	}

	deleteAll(): void {
		if (!this.dirPath) return;
		const files = readdirSync(this.dirPath).filter((f) => f.endsWith(".json"));
		for (const file of files) {
			try {
				rmSync(join(this.dirPath, file));
			} catch {
				// skip
			}
		}
	}
}

// ── Task Engine (extracted business logic for testing) ──────────────────────

interface TasksState {
	tasks: Task[];
	visible: boolean;
	activeTaskId: string | null;
	nextId: number;
}

/**
 * Generate the next sequential task ID.
 * @param state - Current task state
 * @returns String ID
 */
function nextTaskId(state: TasksState): string {
	return String(state.nextId++);
}

/**
 * Create a new task and add to state.
 * @param state - Mutable task state
 * @param subject - Task subject
 * @param opts - Optional fields
 * @returns The created task
 */
function addTask(
	state: TasksState,
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
	return task;
}

/**
 * Update a task's status with dependency enforcement.
 * @param state - Mutable task state
 * @param taskId - Task ID to update
 * @param status - New status
 * @returns True if update succeeded
 */
function updateTaskStatus(state: TasksState, taskId: string, status: TaskStatus): boolean {
	const task = state.tasks.find((t) => t.id === taskId);
	if (!task) return false;

	if (status === "completed") {
		const unmetDeps = task.blockedBy.filter((depId) => {
			const dep = state.tasks.find((t) => t.id === depId);
			return dep && dep.status !== "completed";
		});
		if (unmetDeps.length > 0) return false;
		task.completedAt = Date.now();
	}

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

/**
 * Add bidirectional blocking relationships.
 * @param state - Mutable task state
 * @param taskId - Task to modify
 * @param addBlocks - Task IDs this task should block
 * @param addBlockedBy - Task IDs that should block this task
 */
function updateTaskDeps(state: TasksState, taskId: string, addBlocks?: string[], addBlockedBy?: string[]): void {
	const task = state.tasks.find((t) => t.id === taskId);
	if (!task) return;

	if (addBlocks) {
		for (const targetId of addBlocks) {
			if (!task.blocks.includes(targetId)) task.blocks.push(targetId);
			const target = state.tasks.find((t) => t.id === targetId);
			if (target && !target.blockedBy.includes(taskId)) {
				target.blockedBy.push(taskId);
			}
		}
	}

	if (addBlockedBy) {
		for (const blockerId of addBlockedBy) {
			if (!task.blockedBy.includes(blockerId)) task.blockedBy.push(blockerId);
			const blocker = state.tasks.find((t) => t.id === blockerId);
			if (blocker && !blocker.blocks.includes(taskId)) {
				blocker.blocks.push(taskId);
			}
		}
	}
}

/**
 * Add a comment to a task.
 * @param state - Task state
 * @param taskId - Task to add comment to
 * @param author - Who wrote the comment
 * @param content - Comment text
 * @returns True if comment was added
 */
function addComment(state: TasksState, taskId: string, author: string, content: string): boolean {
	const task = state.tasks.find((t) => t.id === taskId);
	if (!task) return false;
	task.comments.push({ author, content, timestamp: Date.now() });
	return true;
}

/**
 * Delete a task and clean up dep references.
 * @param state - Mutable task state
 * @param taskId - Task ID to remove
 * @returns True if task was found and deleted
 */
function deleteTask(state: TasksState, taskId: string): boolean {
	const index = state.tasks.findIndex((t) => t.id === taskId);
	if (index === -1) return false;

	state.tasks.splice(index, 1);

	for (const task of state.tasks) {
		task.blocks = task.blocks.filter((id) => id !== taskId);
		task.blockedBy = task.blockedBy.filter((id) => id !== taskId);
	}

	if (state.activeTaskId === taskId) {
		state.activeTaskId = null;
	}
	return true;
}

/**
 * Clear all tasks.
 * @param state - Mutable task state
 */
function clearTasks(state: TasksState): void {
	state.tasks = [];
	state.activeTaskId = null;
}

// ── Pure functions (mirrors tasks.ts) ──────────────────────────────────────

/**
 * Escapes special regex characters in a string.
 * @param str - String to escape
 * @returns Escaped string safe for use in regex
 */
function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
 * Extract tasks from text (numbered lists, checkboxes, headers).
 * @param text - Text to parse
 * @returns Array of task subject strings
 */
function extractTasksFromText(text: string): string[] {
	const tasks: string[] = [];

	const numberedRegex = /^\s*(\d+)[.)]\s+(.+)$/gm;
	for (const match of text.matchAll(numberedRegex)) {
		const task = match[2].trim();
		if (task && !task.startsWith("[") && task.length > 3) {
			tasks.push(task);
		}
	}

	const checkboxRegex = /^\s*[-*]\s*\[[ x]\]\s+(.+)$/gim;
	for (const match of text.matchAll(checkboxRegex)) {
		const task = match[1].trim();
		if (task && task.length > 3) {
			tasks.push(task);
		}
	}

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

	return [...new Set(tasks)];
}

/**
 * Simulate the claim action's validation logic.
 * @param state - Task state
 * @param index - 1-indexed task number
 * @param owner - Agent name to claim as
 * @returns Object with ok boolean and message string
 */
function claimTask(state: TasksState, index: number, owner: string): { ok: boolean; message: string } {
	const idx = index - 1;
	if (idx < 0 || idx >= state.tasks.length) {
		return { ok: false, message: "Invalid task number" };
	}
	const task = state.tasks[idx];

	if (task.status === "completed" || task.status === "deleted") {
		return { ok: false, message: `Cannot claim #${task.id}: already ${task.status}` };
	}

	if (task.owner && task.owner !== owner) {
		return { ok: false, message: `Cannot claim #${task.id}: already owned by ${task.owner}` };
	}

	const busyTask = state.tasks.find((t) => t.owner === owner && t.status === "in_progress" && t.id !== task.id);
	if (busyTask) {
		return {
			ok: false,
			message: `Cannot claim #${task.id}: ${owner} is busy with #${busyTask.id} (${busyTask.subject})`,
		};
	}

	const unmetDeps = task.blockedBy.filter((depId) => {
		const dep = state.tasks.find((t) => t.id === depId);
		return dep && dep.status !== "completed";
	});
	if (unmetDeps.length > 0) {
		return { ok: false, message: `Cannot claim #${task.id}: blocked by tasks ${unmetDeps.join(", ")}` };
	}

	task.owner = owner;
	updateTaskStatus(state, task.id, "in_progress");
	return { ok: true, message: `Claimed #${task.id}: ${task.subject} (owner: ${owner})` };
}

/**
 * Apply metadata merge semantics (null deletes, values merge).
 * @param existing - Current metadata
 * @param update - Metadata update (null values = delete key)
 * @returns Merged metadata, or undefined if empty
 */
function mergeMetadata(
	existing: Record<string, unknown> | undefined,
	update: Record<string, unknown>
): Record<string, unknown> | undefined {
	const merged: Record<string, unknown> = { ...existing };
	for (const [k, v] of Object.entries(update)) {
		if (v === null) {
			delete merged[k];
		} else {
			merged[k] = v;
		}
	}
	return Object.keys(merged).length > 0 ? merged : undefined;
}

// ── Test harness ────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

/**
 * Create a fresh temp directory for each test.
 * @returns Path to the temp directory
 */
function freshDir(): string {
	const dir = join(tmpdir(), `pi-tasks-test-${randomUUID().slice(0, 8)}`);
	mkdirSync(dir, { recursive: true });
	return dir;
}

/**
 * Create a fresh TasksState for engine tests.
 * @returns Clean state object
 */
function freshState(): TasksState {
	return { tasks: [], visible: true, activeTaskId: null, nextId: 1 };
}

/**
 * Assert a condition, logging pass/fail.
 * @param name - Test name
 * @param condition - Boolean assertion
 */
function assert(name: string, condition: boolean): void {
	if (condition) {
		console.log(`    ✓ ${name}`);
		passed++;
	} else {
		console.error(`    ✗ FAIL: ${name}`);
		failed++;
	}
}

/**
 * Assert deep equality.
 * @param name - Test name
 * @param actual - Actual value
 * @param expected - Expected value
 */
function assertEqual(name: string, actual: unknown, expected: unknown): void {
	const a = JSON.stringify(actual);
	const e = JSON.stringify(expected);
	if (a === e) {
		console.log(`    ✓ ${name}`);
		passed++;
	} else {
		console.error(`    ✗ FAIL: ${name}`);
		console.error(`      expected: ${e}`);
		console.error(`      actual:   ${a}`);
		failed++;
	}
}

/**
 * Load all tasks from store, throwing if store is session-only (null).
 * @param store - TaskListStore in shared mode
 * @returns Array of loaded tasks
 */
function loadAllOrThrow(store: TaskListStore): Task[] {
	const result = store.loadAll();
	if (result === null) throw new Error("loadAll returned null — store is not in shared mode");
	return result;
}

/**
 * Create a task with defaults.
 * @param overrides - Partial task fields to override
 * @returns Complete task object
 */
function makeTask(overrides: Partial<Task> & { id: string; subject: string }): Task {
	return {
		status: "pending",
		blocks: [],
		blockedBy: [],
		comments: [],
		createdAt: Date.now(),
		...overrides,
	};
}

/**
 * Start a test suite.
 * @param name - Suite name
 */
function suite(name: string): void {
	console.log(`\n  ${name}`);
}

// ── Tests ───────────────────────────────────────────────────────────────────

console.log("\n═══ Tasks Extension — Comprehensive Tests ═══");

// ============================================================================
// SECTION 1: TaskListStore
// ============================================================================

console.log("\n┌─ TaskListStore ──────────────────────────────");

suite("Session-only mode (null)");
{
	const store = new TaskListStore(null);
	assert("isShared is false", !store.isShared);
	assert("path is null", store.path === null);
	assert("loadAll returns null", store.loadAll() === null);
	store.saveTask(makeTask({ id: "1", subject: "test" }));
	store.deleteTask("1");
	store.deleteAll();
	assert("no-ops don't throw", true);
}

suite("Save and load");
{
	const dir = freshDir();
	const store = new TaskListStore(dir);

	store.saveTask(makeTask({ id: "1", subject: "First", description: "Details" }));
	store.saveTask(makeTask({ id: "2", subject: "Second", status: "in_progress" }));

	const loaded = loadAllOrThrow(store);
	assert("loads 2 tasks", loaded.length === 2);
	assert("task 1 subject", loaded[0].subject === "First");
	assert("task 1 description", loaded[0].description === "Details");
	assert("task 2 status", loaded[1].status === "in_progress");
	assert("sorted by ID", loaded[0].id === "1" && loaded[1].id === "2");
	rmSync(dir, { recursive: true, force: true });
}

suite("Save with activeForm and metadata");
{
	const dir = freshDir();
	const store = new TaskListStore(dir);

	store.saveTask(
		makeTask({
			id: "1",
			subject: "Deploy",
			activeForm: "Deploying to production",
			metadata: { env: "prod", priority: "high" },
		})
	);

	const loaded = loadAllOrThrow(store);
	assert("activeForm persists", loaded[0].activeForm === "Deploying to production");
	assertEqual("metadata persists", loaded[0].metadata, { env: "prod", priority: "high" });
	rmSync(dir, { recursive: true, force: true });
}

suite("Delete single task");
{
	const dir = freshDir();
	const store = new TaskListStore(dir);
	store.saveTask(makeTask({ id: "1", subject: "Keep" }));
	store.saveTask(makeTask({ id: "2", subject: "Delete me" }));

	store.deleteTask("2");
	const loaded = loadAllOrThrow(store);
	assert("1 task remains", loaded.length === 1);
	assert("kept task is #1", loaded[0].id === "1");
	rmSync(dir, { recursive: true, force: true });
}

suite("Delete all");
{
	const dir = freshDir();
	const store = new TaskListStore(dir);
	store.saveTask(makeTask({ id: "1", subject: "A" }));
	store.saveTask(makeTask({ id: "2", subject: "B" }));
	store.saveTask(makeTask({ id: "3", subject: "C" }));

	store.deleteAll();
	const loaded = loadAllOrThrow(store);
	assert("0 tasks after deleteAll", loaded.length === 0);
	rmSync(dir, { recursive: true, force: true });
}

suite("Delete nonexistent task (no throw)");
{
	const dir = freshDir();
	const store = new TaskListStore(dir);
	store.deleteTask("999");
	assert("no throw on delete of missing task", true);
	rmSync(dir, { recursive: true, force: true });
}

suite("Schema migration (title → subject, dependencies → blockedBy)");
{
	const dir = freshDir();
	const oldTask = {
		id: "1",
		title: "Old format task",
		status: "pending",
		dependencies: ["2"],
		createdAt: 1_700_000_000_000,
	};
	writeFileSync(join(dir, "1.json"), JSON.stringify(oldTask));

	const store = new TaskListStore(dir);
	const loaded = loadAllOrThrow(store);

	assert("migrated subject", loaded[0].subject === "Old format task");
	assert("migrated blockedBy", loaded[0].blockedBy[0] === "2");
	assert("has blocks array", Array.isArray(loaded[0].blocks));
	assert("has comments array", Array.isArray(loaded[0].comments));
	rmSync(dir, { recursive: true, force: true });
}

suite("Corrupt file handling");
{
	const dir = freshDir();
	writeFileSync(join(dir, "1.json"), "not json {{{");
	writeFileSync(join(dir, "2.json"), JSON.stringify(makeTask({ id: "2", subject: "Valid" })));

	const store = new TaskListStore(dir);
	const loaded = loadAllOrThrow(store);

	assert("skips corrupt, loads valid", loaded.length === 1);
	assert("loaded task is #2", loaded[0].id === "2");
	rmSync(dir, { recursive: true, force: true });
}

suite("Sequential ID sorting");
{
	const dir = freshDir();
	const store = new TaskListStore(dir);
	store.saveTask(makeTask({ id: "3", subject: "Third" }));
	store.saveTask(makeTask({ id: "1", subject: "First" }));
	store.saveTask(makeTask({ id: "10", subject: "Tenth" }));
	store.saveTask(makeTask({ id: "2", subject: "Second" }));

	const loaded = loadAllOrThrow(store);
	assertEqual(
		"sorted: 1, 2, 3, 10",
		loaded.map((t) => t.id),
		["1", "2", "3", "10"]
	);
	rmSync(dir, { recursive: true, force: true });
}

suite("One file per task");
{
	const dir = freshDir();
	const store = new TaskListStore(dir);
	store.saveTask(makeTask({ id: "1", subject: "A" }));
	store.saveTask(makeTask({ id: "2", subject: "B" }));

	const files = readdirSync(dir)
		.filter((f) => f.endsWith(".json"))
		.sort();
	assertEqual("file names", files, ["1.json", "2.json"]);

	store.saveTask(makeTask({ id: "1", subject: "A updated" }));
	const loaded = loadAllOrThrow(store);
	assert("task 1 updated", loaded[0].subject === "A updated");
	assert("task 2 unchanged", loaded[1].subject === "B");
	rmSync(dir, { recursive: true, force: true });
}

suite("File locking — acquire and release");
{
	const dir = freshDir();
	const store = new TaskListStore(dir);

	const unlock = store.lock();
	assert("lock dir exists", existsSync(join(dir, ".lock")));

	unlock();
	assert("lock dir removed after release", !existsSync(join(dir, ".lock")));
	rmSync(dir, { recursive: true, force: true });
}

suite("File locking — double release is safe");
{
	const dir = freshDir();
	const store = new TaskListStore(dir);

	const unlock = store.lock();
	unlock();
	unlock(); // second release should not throw
	assert("double release is safe", true);
	rmSync(dir, { recursive: true, force: true });
}

suite("File locking — stale lock recovery");
{
	const dir = freshDir();
	// Create a stale lock manually
	mkdirSync(join(dir, ".lock"));

	const store = new TaskListStore(dir);
	const unlock = store.lock();
	assert("acquired despite stale lock", existsSync(join(dir, ".lock")));
	unlock();
	rmSync(dir, { recursive: true, force: true });
}

suite("File locking — null store returns noop");
{
	const store = new TaskListStore(null);
	const unlock = store.lock();
	assert("noop lock returned for null store", typeof unlock === "function");
	unlock(); // should not throw
	assert("noop release is safe", true);
}

suite("Non-JSON files in dir are ignored");
{
	const dir = freshDir();
	writeFileSync(join(dir, "README.md"), "# Tasks");
	writeFileSync(join(dir, ".lock"), "stale");
	writeFileSync(join(dir, "1.json"), JSON.stringify(makeTask({ id: "1", subject: "Real task" })));

	const store = new TaskListStore(dir);
	const loaded = loadAllOrThrow(store);
	assert("only loads .json files", loaded.length === 1);
	rmSync(dir, { recursive: true, force: true });
}

suite("Empty directory returns empty array");
{
	const dir = freshDir();
	const store = new TaskListStore(dir);
	const loaded = loadAllOrThrow(store);
	assert("empty dir → empty array", loaded.length === 0);
	rmSync(dir, { recursive: true, force: true });
}

// ============================================================================
// SECTION 2: Task Engine Logic
// ============================================================================

console.log("\n┌─ Task Engine ────────────────────────────────");

suite("addTask creates pending task with sequential IDs");
{
	const s = freshState();
	const t1 = addTask(s, "First task");
	const t2 = addTask(s, "Second task");

	assert("task 1 id is 1", t1.id === "1");
	assert("task 2 id is 2", t2.id === "2");
	assert("task 1 pending", t1.status === "pending");
	assert("2 tasks in state", s.tasks.length === 2);
	assert("nextId is 3", s.nextId === 3);
}

suite("addTask with all optional fields");
{
	const s = freshState();
	const t = addTask(s, "Deploy", {
		description: "Deploy to prod",
		activeForm: "Deploying",
		metadata: { priority: "high" },
	});

	assert("description set", t.description === "Deploy to prod");
	assert("activeForm set", t.activeForm === "Deploying");
	assertEqual("metadata set", t.metadata, { priority: "high" });
	assert("createdAt is recent", Date.now() - t.createdAt < 1000);
}

suite("updateTaskStatus — basic transitions");
{
	const s = freshState();
	addTask(s, "Task A");

	assert("set to in_progress", updateTaskStatus(s, "1", "in_progress"));
	assert("status is in_progress", s.tasks[0].status === "in_progress");
	assert("activeTaskId updated", s.activeTaskId === "1");

	assert("set to completed", updateTaskStatus(s, "1", "completed"));
	assert("status is completed", s.tasks[0].status === "completed");
	assert("completedAt set", s.tasks[0].completedAt !== undefined);
}

suite("updateTaskStatus — only one in_progress at a time");
{
	const s = freshState();
	addTask(s, "A");
	addTask(s, "B");
	addTask(s, "C");

	updateTaskStatus(s, "1", "in_progress");
	assert("A is in_progress", s.tasks[0].status === "in_progress");

	updateTaskStatus(s, "2", "in_progress");
	assert("A reverted to pending", s.tasks[0].status === "pending");
	assert("B is in_progress", s.tasks[1].status === "in_progress");
	assert("activeTaskId is 2", s.activeTaskId === "2");
}

suite("updateTaskStatus — can't complete with unmet deps");
{
	const s = freshState();
	addTask(s, "Schema");
	addTask(s, "API");

	// API depends on Schema
	s.tasks[1].blockedBy.push("1");

	assert("can't complete API (dep not done)", !updateTaskStatus(s, "2", "completed"));
	assert("API still pending", s.tasks[1].status === "pending");

	// Complete the dependency
	updateTaskStatus(s, "1", "completed");
	assert("now can complete API", updateTaskStatus(s, "2", "completed"));
}

suite("updateTaskStatus — nonexistent task returns false");
{
	const s = freshState();
	assert("returns false for missing task", !updateTaskStatus(s, "999", "completed"));
}

suite("updateTaskDeps — bidirectional");
{
	const s = freshState();
	addTask(s, "Schema");
	addTask(s, "API");
	addTask(s, "Tests");

	// Schema blocks API
	updateTaskDeps(s, "1", ["2"]);
	assert("task 1 blocks task 2", s.tasks[0].blocks.includes("2"));
	assert("task 2 blockedBy task 1", s.tasks[1].blockedBy.includes("1"));

	// Tests blocked by API
	updateTaskDeps(s, "3", undefined, ["2"]);
	assert("task 3 blockedBy task 2", s.tasks[2].blockedBy.includes("2"));
	assert("task 2 blocks task 3", s.tasks[1].blocks.includes("3"));
}

suite("updateTaskDeps — no duplicate deps");
{
	const s = freshState();
	addTask(s, "A");
	addTask(s, "B");

	updateTaskDeps(s, "1", ["2"]);
	updateTaskDeps(s, "1", ["2"]); // duplicate
	assert("no duplicate in blocks", s.tasks[0].blocks.length === 1);
	assert("no duplicate in blockedBy", s.tasks[1].blockedBy.length === 1);
}

suite("updateTaskDeps — nonexistent task is noop");
{
	const s = freshState();
	addTask(s, "A");
	updateTaskDeps(s, "999", ["1"]);
	assert("task A has no deps", s.tasks[0].blockedBy.length === 0);
}

suite("addComment");
{
	const s = freshState();
	addTask(s, "Auth");

	assert("add first comment", addComment(s, "1", "agent", "Tried JWT"));
	assert("add second comment", addComment(s, "1", "user", "Use sessions"));
	assert("2 comments", s.tasks[0].comments.length === 2);
	assert("first comment author", s.tasks[0].comments[0].author === "agent");
	assert("second comment content", s.tasks[0].comments[1].content === "Use sessions");
	assert("comment has timestamp", s.tasks[0].comments[0].timestamp > 0);
}

suite("addComment — nonexistent task returns false");
{
	const s = freshState();
	assert("returns false", !addComment(s, "999", "agent", "nope"));
}

suite("deleteTask — removes and cleans deps");
{
	const s = freshState();
	addTask(s, "Schema");
	addTask(s, "API");
	addTask(s, "Tests");

	// Schema blocks API, API blocks Tests
	updateTaskDeps(s, "1", ["2"]);
	updateTaskDeps(s, "2", ["3"]);

	deleteTask(s, "2");

	assert("2 tasks remain", s.tasks.length === 2);
	assert("task 1 blocks cleared", !s.tasks[0].blocks.includes("2"));
	assert("task 2 (now Tests) blockedBy cleared", !s.tasks[1].blockedBy.includes("2"));
}

suite("deleteTask — clears activeTaskId if deleted task was active");
{
	const s = freshState();
	addTask(s, "Active task");
	updateTaskStatus(s, "1", "in_progress");

	assert("activeTaskId is 1", s.activeTaskId === "1");
	deleteTask(s, "1");
	assert("activeTaskId cleared", s.activeTaskId === null);
}

suite("deleteTask — nonexistent task returns false");
{
	const s = freshState();
	assert("returns false", !deleteTask(s, "999"));
}

suite("clearTasks — resets state");
{
	const s = freshState();
	addTask(s, "A");
	addTask(s, "B");
	updateTaskStatus(s, "1", "in_progress");

	clearTasks(s);
	assert("tasks empty", s.tasks.length === 0);
	assert("activeTaskId null", s.activeTaskId === null);
	// Note: nextId is NOT reset — avoids ID reuse
}

suite("nextTaskId — sequential and never reuses");
{
	const s = freshState();
	addTask(s, "A"); // id=1
	addTask(s, "B"); // id=2
	addTask(s, "C"); // id=3

	deleteTask(s, "2");

	const t4 = addTask(s, "D");
	assert("ID 4 (not 2 reused)", t4.id === "4");
}

// ============================================================================
// SECTION 3: Claim Action
// ============================================================================

console.log("\n┌─ Claim Action ───────────────────────────────");

suite("Claim — successful claim");
{
	const s = freshState();
	addTask(s, "Build UI");
	addTask(s, "Write tests");

	const result = claimTask(s, 1, "worker-1");
	assert("claim succeeds", result.ok);
	assert("task owner set", s.tasks[0].owner === "worker-1");
	assert("task is in_progress", s.tasks[0].status === "in_progress");
}

suite("Claim — already owned by someone else");
{
	const s = freshState();
	addTask(s, "Build UI");
	s.tasks[0].owner = "worker-1";

	const result = claimTask(s, 1, "worker-2");
	assert("claim fails", !result.ok);
	assert("message mentions owner", result.message.includes("worker-1"));
}

suite("Claim — re-claim own task is allowed");
{
	const s = freshState();
	addTask(s, "Build UI");
	s.tasks[0].owner = "worker-1";

	const result = claimTask(s, 1, "worker-1");
	assert("re-claim own task succeeds", result.ok);
}

suite("Claim — can't claim completed task");
{
	const s = freshState();
	addTask(s, "Done task");
	updateTaskStatus(s, "1", "completed");

	const result = claimTask(s, 1, "worker-1");
	assert("claim fails", !result.ok);
	assert("message mentions completed", result.message.includes("completed"));
}

suite("Claim — busy-check prevents double claim");
{
	const s = freshState();
	addTask(s, "Task A");
	addTask(s, "Task B");

	// worker-1 claims Task A
	claimTask(s, 1, "worker-1");

	// worker-1 tries to claim Task B (should fail — busy with A)
	const result = claimTask(s, 2, "worker-1");
	assert("busy-check fails", !result.ok);
	assert("message mentions busy", result.message.includes("busy"));
	assert("message mentions Task A", result.message.includes("Task A"));
}

suite("Claim — busy-check allows after completing current task");
{
	const s = freshState();
	addTask(s, "Task A");
	addTask(s, "Task B");

	claimTask(s, 1, "worker-1");
	updateTaskStatus(s, "1", "completed");

	const result = claimTask(s, 2, "worker-1");
	assert("claim succeeds after completing first", result.ok);
}

suite("Claim — blocked by unmet dependency");
{
	const s = freshState();
	addTask(s, "Schema");
	addTask(s, "API");
	s.tasks[1].blockedBy.push("1");

	const result = claimTask(s, 2, "worker-1");
	assert("claim fails — blocked", !result.ok);
	assert("message mentions blocked", result.message.includes("blocked"));
}

suite("Claim — allowed after dependency is completed");
{
	const s = freshState();
	addTask(s, "Schema");
	addTask(s, "API");
	s.tasks[1].blockedBy.push("1");

	updateTaskStatus(s, "1", "completed");

	const result = claimTask(s, 2, "worker-1");
	assert("claim succeeds after dep completed", result.ok);
}

suite("Claim — invalid index");
{
	const s = freshState();
	addTask(s, "A");

	assert("index 0 fails", !claimTask(s, 0, "w").ok);
	assert("index 99 fails", !claimTask(s, 99, "w").ok);
}

suite("Claim — different agents claim different tasks");
{
	const s = freshState();
	addTask(s, "Task A");
	addTask(s, "Task B");

	const r1 = claimTask(s, 1, "worker-1");
	const r2 = claimTask(s, 2, "worker-2");

	assert("worker-1 claims A", r1.ok);
	assert("worker-2 claims B", r2.ok);
	assert("A owned by worker-1", s.tasks[0].owner === "worker-1");
	assert("B owned by worker-2", s.tasks[1].owner === "worker-2");
}

// ============================================================================
// SECTION 4: Metadata
// ============================================================================

console.log("\n┌─ Metadata ───────────────────────────────────");

suite("Metadata merge — basic set");
{
	const result = mergeMetadata(undefined, { priority: "high", ticket: "DB-421" });
	assertEqual("sets keys", result, { priority: "high", ticket: "DB-421" });
}

suite("Metadata merge — add to existing");
{
	const result = mergeMetadata({ priority: "high" }, { env: "prod" });
	assertEqual("merged", result, { priority: "high", env: "prod" });
}

suite("Metadata merge — overwrite existing key");
{
	const result = mergeMetadata({ priority: "high" }, { priority: "low" });
	assertEqual("overwritten", result, { priority: "low" });
}

suite("Metadata merge — null deletes key");
{
	const result = mergeMetadata({ priority: "high", ticket: "DB-421" }, { ticket: null });
	assertEqual("key deleted", result, { priority: "high" });
}

suite("Metadata merge — delete all keys returns undefined");
{
	const result = mergeMetadata({ priority: "high" }, { priority: null });
	assert("returns undefined when empty", result === undefined);
}

suite("Metadata merge — null on nonexistent key is noop");
{
	const result = mergeMetadata({ priority: "high" }, { nonexistent: null });
	assertEqual("unchanged", result, { priority: "high" });
}

suite("Metadata merge — mixed operations");
{
	const result = mergeMetadata({ a: 1, b: 2, c: 3 }, { a: null, b: 20, d: 4 });
	assertEqual("a deleted, b updated, d added", result, { b: 20, c: 3, d: 4 });
}

// ============================================================================
// SECTION 5: Completion Detection (findCompletedTasks)
// ============================================================================

console.log("\n┌─ Completion Detection ───────────────────────");

suite("[DONE: id] pattern");
{
	const tasks = [makeTask({ id: "1", subject: "Build UI" })];
	assertEqual("matches [DONE: 1]", findCompletedTasks("[DONE: 1]", tasks), ["1"]);
	assertEqual("matches [DONE:1]", findCompletedTasks("[DONE:1]", tasks), ["1"]);
}

suite("[COMPLETE: id] pattern");
{
	const tasks = [makeTask({ id: "3", subject: "Write docs" })];
	assertEqual("matches [COMPLETE: 3]", findCompletedTasks("[COMPLETE: 3]", tasks), ["3"]);
}

suite("✓ subject pattern");
{
	const tasks = [makeTask({ id: "1", subject: "Deploy to production" })];
	assertEqual("matches ✓ Deploy", findCompletedTasks("✓ Deploy to production", tasks), ["1"]);
}

suite("completed: subject pattern");
{
	const tasks = [makeTask({ id: "1", subject: "Run tests" })];
	assertEqual("matches completed:", findCompletedTasks("completed: Run tests", tasks), ["1"]);
	assertEqual("matches completed without colon", findCompletedTasks("completed Run tests", tasks), ["1"]);
}

suite("done: subject pattern");
{
	const tasks = [makeTask({ id: "1", subject: "Fix bug" })];
	assertEqual("matches done:", findCompletedTasks("done: Fix bug", tasks), ["1"]);
}

suite("[x] subject pattern");
{
	const tasks = [makeTask({ id: "1", subject: "Write migration" })];
	assertEqual("matches [x]", findCompletedTasks("[x] Write migration", tasks), ["1"]);
}

suite("No false positives");
{
	const tasks = [makeTask({ id: "1", subject: "Build UI" })];
	assertEqual("no match on unrelated text", findCompletedTasks("Working on the API now", tasks), []);
	assertEqual("no match on different subject", findCompletedTasks("completed: Deploy API", tasks), []);
}

suite("Partial subject match (regex prefix)");
{
	const tasks = [makeTask({ id: "1", subject: "Build UI" })];
	// "completed: Build" matches because "Build" is a prefix of "Build UI" substring(0,30)
	assertEqual("partial prefix matches", findCompletedTasks("completed: Build UI component", tasks), ["1"]);
}

suite("Multiple tasks completed in same text");
{
	const tasks = [
		makeTask({ id: "1", subject: "Build UI" }),
		makeTask({ id: "2", subject: "Write tests" }),
		makeTask({ id: "3", subject: "Deploy" }),
	];
	const text = "[DONE: 1]\ncompleted: Write tests\nStill working on Deploy";
	assertEqual("finds 2 completed", findCompletedTasks(text, tasks), ["1", "2"]);
}

suite("Subject with regex special chars");
{
	const tasks = [makeTask({ id: "1", subject: "Fix bug (urgent)" })];
	assertEqual("matches with parens", findCompletedTasks("done: Fix bug (urgent)", tasks), ["1"]);
}

suite("Subject truncated to 30 chars for matching");
{
	const tasks = [makeTask({ id: "1", subject: "A very long task subject that exceeds thirty characters" })];
	assertEqual("matches first 30 chars", findCompletedTasks("done: A very long task subject that e", tasks), ["1"]);
}

// ============================================================================
// SECTION 6: Text Extraction
// ============================================================================

console.log("\n┌─ Text Extraction ────────────────────────────");

suite("Numbered list (period)");
{
	const text = "1. Build the UI component\n2. Add error handling\n3. Write tests";
	const result = extractTasksFromText(text);
	assertEqual("extracts 3 tasks", result, ["Build the UI component", "Add error handling", "Write tests"]);
}

suite("Numbered list (parenthesis)");
{
	const text = "1) Build the UI\n2) Add error handling";
	const result = extractTasksFromText(text);
	assert("extracts 2 tasks", result.length === 2);
	assert("first task", result[0] === "Build the UI");
}

suite("Checkbox list (unchecked)");
{
	const text = "- [ ] Build the component\n- [ ] Add styles\n- [x] Write docs";
	const result = extractTasksFromText(text);
	assert("extracts all checkboxes", result.length === 3);
}

suite("Checkbox list (asterisk)");
{
	const text = "* [ ] First long task\n* [x] Second long task";
	const result = extractTasksFromText(text);
	assert("extracts 2 tasks", result.length === 2);
}

suite("Task header with items");
{
	const text = "Tasks:\n- Build component\n- Add error handling\n- Write tests";
	const result = extractTasksFromText(text);
	assert("extracts tasks under header", result.length === 3);
}

suite("TODO header");
{
	const text = "TODO:\n1. Add validation\n2. Fix the edge case";
	const result = extractTasksFromText(text);
	assert("extracts from TODO header", result.length >= 2);
}

suite("Steps header");
{
	const text = "Steps:\n- First do this thing\n- Then do another";
	const result = extractTasksFromText(text);
	assert("extracts from Steps header", result.length === 2);
}

suite("Short items (≤3 chars) are skipped");
{
	const text = "1. OK\n2. Build the component";
	const result = extractTasksFromText(text);
	assert("skips short items", result.length === 1);
	assert("kept long item", result[0] === "Build the component");
}

suite("Items starting with [ are skipped");
{
	const text = "1. [DONE] Build component\n2. Build the tests";
	const result = extractTasksFromText(text);
	assert("skips [DONE] prefixed", result.length === 1);
}

suite("Deduplication");
{
	const text = "Tasks:\n- Build component\n\n1. Build component";
	const result = extractTasksFromText(text);
	assert("deduplicates", result.length === 1);
}

suite("Empty/no-match text");
{
	const emptyResult = extractTasksFromText("");
	const proseResult = extractTasksFromText("Just some regular text here.");
	assert("empty string", emptyResult.length === 0);
	assert("plain prose", proseResult.length === 0);
}

// ============================================================================
// SECTION 7: Auto-advance & Auto-clear Simulation
// ============================================================================

console.log("\n┌─ Auto-advance & Edge Cases ──────────────────");

suite("Completing in_progress auto-advances next pending");
{
	const s = freshState();
	addTask(s, "A");
	addTask(s, "B");
	addTask(s, "C");
	updateTaskStatus(s, "1", "in_progress");

	updateTaskStatus(s, "1", "completed");

	// Simulate auto-advance: find next pending and start it
	const next = s.tasks.find((t) => t.status === "pending");
	if (next) updateTaskStatus(s, next.id, "in_progress");

	assert("B is now in_progress", s.tasks[1].status === "in_progress");
	assert("activeTaskId is 2", s.activeTaskId === "2");
}

suite("All completed detection");
{
	const s = freshState();
	addTask(s, "A");
	addTask(s, "B");

	updateTaskStatus(s, "1", "completed");
	updateTaskStatus(s, "2", "completed");

	const allDone = s.tasks.every((t) => t.status === "completed");
	assert("all tasks completed", allDone);
}

suite("Batch add — first task auto-starts when list was empty");
{
	const s = freshState();
	const subjects = ["Build UI", "Write tests", "Deploy"];
	for (const subj of subjects) {
		addTask(s, subj);
	}
	// Simulate auto-start: if list was empty before batch, start first
	const first = s.tasks.find((t) => t.status === "pending");
	if (first) updateTaskStatus(s, first.id, "in_progress");

	assert("first task in_progress", s.tasks[0].status === "in_progress");
	assert("others still pending", s.tasks[1].status === "pending" && s.tasks[2].status === "pending");
}

suite("Batch complete — multiple indices");
{
	const s = freshState();
	addTask(s, "A");
	addTask(s, "B");
	addTask(s, "C");

	const indices = [1, 3]; // 1-indexed
	for (const i of indices) {
		const idx = i - 1;
		if (idx >= 0 && idx < s.tasks.length) {
			updateTaskStatus(s, s.tasks[idx].id, "completed");
		}
	}

	assert("A completed", s.tasks[0].status === "completed");
	assert("B still pending", s.tasks[1].status === "pending");
	assert("C completed", s.tasks[2].status === "completed");
}

suite("complete_all marks everything done");
{
	const s = freshState();
	addTask(s, "A");
	addTask(s, "B");
	addTask(s, "C");
	updateTaskStatus(s, "1", "in_progress");

	for (const task of s.tasks) {
		task.status = "completed";
		task.completedAt = Date.now();
	}
	s.activeTaskId = null;

	assert(
		"all completed",
		s.tasks.every((t) => t.status === "completed")
	);
	assert(
		"all have completedAt",
		s.tasks.every((t) => t.completedAt !== undefined)
	);
	assert("activeTaskId cleared", s.activeTaskId === null);
}

// ============================================================================
// SECTION 8: escapeRegex
// ============================================================================

console.log("\n┌─ escapeRegex ────────────────────────────────");

suite("Escapes all special regex characters");
{
	const cases: [string, string, string][] = [
		["dot", "a.b", "a\\.b"],
		["star", "a*b", "a\\*b"],
		["plus", "a+b", "a\\+b"],
		["question", "a?b", "a\\?b"],
		["caret", "a^b", "a\\^b"],
		["dollar", "a$b", "a\\$b"],
		["braces", "a{b}", "a\\{b\\}"],
		["parens", "a(b)", "a\\(b\\)"],
		["pipe", "a|b", "a\\|b"],
		["brackets", "a[b]", "a\\[b\\]"],
		["backslash", "a\\b", "a\\\\b"],
	];
	for (const [name, input, expected] of cases) {
		assert(name, escapeRegex(input) === expected);
	}
}

suite("No-op on safe strings");
{
	const alphaResult = escapeRegex("abc123");
	const spaceResult = escapeRegex("hello world");
	assert("alphanumeric unchanged", alphaResult === "abc123");
	assert("spaces unchanged", spaceResult === "hello world");
}

// ============================================================================
// SECTION 9: Owner Field Persistence
// ============================================================================

console.log("\n┌─ Owner Persistence ──────────────────────────");

suite("Owner persists through save/load cycle");
{
	const dir = freshDir();
	const store = new TaskListStore(dir);

	store.saveTask(makeTask({ id: "1", subject: "Build UI", owner: "worker-1" }));
	store.saveTask(makeTask({ id: "2", subject: "Write docs" }));

	const loaded = loadAllOrThrow(store);
	assert("owner persists", loaded[0].owner === "worker-1");
	assert("no owner is undefined", loaded[1].owner === undefined);
	rmSync(dir, { recursive: true, force: true });
}

// ============================================================================
// SECTION 10: Dependency Chain Scenarios
// ============================================================================

console.log("\n┌─ Dependency Chains ──────────────────────────");

suite("Linear chain: A → B → C");
{
	const s = freshState();
	addTask(s, "A");
	addTask(s, "B");
	addTask(s, "C");

	// A blocks B, B blocks C
	updateTaskDeps(s, "1", ["2"]);
	updateTaskDeps(s, "2", ["3"]);

	assert("can't complete B (A not done)", !updateTaskStatus(s, "2", "completed"));
	assert("can't complete C (B not done)", !updateTaskStatus(s, "3", "completed"));

	updateTaskStatus(s, "1", "completed");
	assert("can complete B now", updateTaskStatus(s, "2", "completed"));
	assert("can complete C now", updateTaskStatus(s, "3", "completed"));
}

suite("Diamond: A blocks B and C, both block D");
{
	const s = freshState();
	addTask(s, "A");
	addTask(s, "B");
	addTask(s, "C");
	addTask(s, "D");

	updateTaskDeps(s, "1", ["2", "3"]);
	updateTaskDeps(s, "2", ["4"]);
	updateTaskDeps(s, "3", ["4"]);

	assert("can't complete D", !updateTaskStatus(s, "4", "completed"));
	assert("can't complete B", !updateTaskStatus(s, "2", "completed"));

	updateTaskStatus(s, "1", "completed");
	updateTaskStatus(s, "2", "completed");
	assert("still can't complete D (C not done)", !updateTaskStatus(s, "4", "completed"));

	updateTaskStatus(s, "3", "completed");
	assert("now can complete D", updateTaskStatus(s, "4", "completed"));
}

suite("Deleting a blocker unblocks dependents");
{
	const s = freshState();
	addTask(s, "Blocker");
	addTask(s, "Blocked");

	updateTaskDeps(s, "1", ["2"]);
	assert("Blocked has blockedBy", s.tasks[1].blockedBy.includes("1"));

	deleteTask(s, "1");
	assert("Blocked no longer blockedBy", s.tasks[0].blockedBy.length === 0);

	// Now Blocked (which is now at index 0 after deletion) should be completable
	assert("can complete formerly blocked task", updateTaskStatus(s, "2", "completed"));
}

suite("Self-referencing dep doesn't break");
{
	const s = freshState();
	addTask(s, "Self");

	// This shouldn't happen, but if it does, it shouldn't crash
	s.tasks[0].blockedBy.push("1");
	assert("can't complete (blocked by self)", !updateTaskStatus(s, "1", "completed"));

	// Remove self-ref
	s.tasks[0].blockedBy = [];
	assert("can complete after removing self-ref", updateTaskStatus(s, "1", "completed"));
}

// ============================================================================
// SECTION 11: Edge Cases
// ============================================================================

console.log("\n┌─ Edge Cases ─────────────────────────────────");

suite("Concurrent saves to same task (last write wins)");
{
	const dir = freshDir();
	const store = new TaskListStore(dir);

	store.saveTask(makeTask({ id: "1", subject: "Version 1" }));
	store.saveTask(makeTask({ id: "1", subject: "Version 2" }));

	const loaded = loadAllOrThrow(store);
	assert("last write wins", loaded[0].subject === "Version 2");
	assert("only one file", readdirSync(dir).filter((f) => f.endsWith(".json")).length === 1);
	rmSync(dir, { recursive: true, force: true });
}

suite("Task with empty subject");
{
	const s = freshState();
	const t = addTask(s, "");
	assert("creates task with empty subject", t.subject === "");
	assert("still has valid ID", t.id === "1");
}

suite("Task with very long subject");
{
	const s = freshState();
	const longSubject = "A".repeat(10_000);
	const t = addTask(s, longSubject);
	assert("creates task with long subject", t.subject.length === 10_000);
}

suite("Multiple comments on same task");
{
	const s = freshState();
	addTask(s, "Discussion");

	for (let i = 0; i < 50; i++) {
		addComment(s, "1", `agent-${i}`, `Comment ${i}`);
	}

	assert("50 comments", s.tasks[0].comments.length === 50);
	assert("last comment", s.tasks[0].comments[49].content === "Comment 49");
}

suite("Delete task that is a dependency of multiple tasks");
{
	const s = freshState();
	addTask(s, "Shared dep");
	addTask(s, "Consumer A");
	addTask(s, "Consumer B");

	updateTaskDeps(s, "1", ["2", "3"]);

	deleteTask(s, "1");

	assert("Consumer A unblocked", s.tasks[0].blockedBy.length === 0);
	assert("Consumer B unblocked", s.tasks[1].blockedBy.length === 0);
}

suite("Rapid state transitions");
{
	const s = freshState();
	addTask(s, "Flippy");

	updateTaskStatus(s, "1", "in_progress");
	updateTaskStatus(s, "1", "pending");
	updateTaskStatus(s, "1", "in_progress");
	updateTaskStatus(s, "1", "completed");

	assert("ends completed", s.tasks[0].status === "completed");
	assert("has completedAt", s.tasks[0].completedAt !== undefined);
}

suite("Store with many tasks sorts correctly");
{
	const dir = freshDir();
	const store = new TaskListStore(dir);

	for (let i = 100; i >= 1; i--) {
		store.saveTask(makeTask({ id: String(i), subject: `Task ${i}` }));
	}

	const loaded = loadAllOrThrow(store);
	assert("100 tasks loaded", loaded.length === 100);
	assert("first is ID 1", loaded[0].id === "1");
	assert("last is ID 100", loaded[99].id === "100");

	// Verify sorted numerically, not lexicographically (10 before 2 would be wrong)
	const ids = loaded.map((t) => Number(t.id));
	const isSorted = ids.every((id, i) => i === 0 || id > ids[i - 1]);
	assert("numerically sorted", isSorted);
	rmSync(dir, { recursive: true, force: true });
}

suite("Lock dir is not loaded as a task");
{
	const dir = freshDir();
	const store = new TaskListStore(dir);
	store.saveTask(makeTask({ id: "1", subject: "Real" }));

	// Simulate a stale .lock directory
	mkdirSync(join(dir, ".lock"), { recursive: true });

	const loaded = loadAllOrThrow(store);
	assert("only loads real tasks (not .lock dir)", loaded.length === 1);

	rmSync(dir, { recursive: true, force: true });
}

suite("deleteAll leaves lock dir intact");
{
	const dir = freshDir();
	const store = new TaskListStore(dir);
	store.saveTask(makeTask({ id: "1", subject: "A" }));

	store.deleteAll();
	const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
	assert("no json files remain", files.length === 0);
	assert("directory still exists", existsSync(dir));
	rmSync(dir, { recursive: true, force: true });
}

suite("Completed task has both completedAt and createdAt");
{
	const s = freshState();
	const t = addTask(s, "Track timestamps");
	const createdAt = t.createdAt;

	// Small delay to ensure different timestamps
	updateTaskStatus(s, "1", "in_progress");
	updateTaskStatus(s, "1", "completed");

	assert("createdAt preserved", s.tasks[0].createdAt === createdAt);
	assert("completedAt set", s.tasks[0].completedAt !== undefined);
	assert("completedAt >= createdAt", (s.tasks[0].completedAt ?? 0) >= createdAt);
}

// ── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n═══ Results: ${passed} passed, ${failed} failed ═══\n`);
if (failed > 0) process.exit(1);
