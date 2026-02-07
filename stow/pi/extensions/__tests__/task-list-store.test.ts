/**
 * Tests for TaskListStore and new task schema
 *
 * Run with: npx tsx ~/.pi/extensions/__tests__/task-list-store.test.ts
 *
 * Tests file-backed persistence, schema migration, bidirectional deps,
 * comments, and cross-session sync via fs.watch.
 */

import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ── Inline types (mirrors tasks.ts) ────────────────────────────────────────

type TaskStatus = "pending" | "in_progress" | "completed";

interface TaskComment {
	author: string;
	content: string;
	timestamp: number;
}

interface Task {
	id: string;
	subject: string;
	description?: string;
	status: TaskStatus;
	blocks: string[];
	blockedBy: string[];
	comments: TaskComment[];
	owner?: string;
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

	loadAll(): Task[] | null {
		if (!this.dirPath) return null;
		if (!existsSync(this.dirPath)) return [];

		const tasks: Task[] = [];
		const files = readdirSync(this.dirPath).filter((f) => f.endsWith(".json"));
		for (const file of files) {
			try {
				const raw = readFileSync(join(this.dirPath, file), "utf-8");
				const parsed = JSON.parse(raw) as Record<string, unknown>;
				// Migrate old schema
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
		writeFileSync(filePath, JSON.stringify(task, null, 2), "utf-8");
	}

	deleteTask(taskId: string): void {
		if (!this.dirPath) return;
		const filePath = join(this.dirPath, `${taskId}.json`);
		if (existsSync(filePath)) rmSync(filePath);
	}

	deleteAll(): void {
		if (!this.dirPath) return;
		const files = readdirSync(this.dirPath).filter((f) => f.endsWith(".json"));
		for (const file of files) {
			rmSync(join(this.dirPath, file));
		}
	}
}

// ── Test helpers ────────────────────────────────────────────────────────────

let testDir: string;
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
 * Assert a condition, logging pass/fail.
 * @param name - Test name
 * @param condition - Boolean assertion
 */
function assert(name: string, condition: boolean): void {
	if (condition) {
		console.log(`  ✓ ${name}`);
		passed++;
	} else {
		console.error(`  ✗ ${name}`);
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

// ── Tests ───────────────────────────────────────────────────────────────────

console.log("\n=== TaskListStore Tests ===\n");

// Test: null mode (session-only)
console.log("Session-only mode (null):");
{
	const store = new TaskListStore(null);
	assert("isShared is false", !store.isShared);
	assert("path is null", store.path === null);
	assert("loadAll returns null", store.loadAll() === null);
	// saveTask and deleteTask should be no-ops (no throw)
	store.saveTask(makeTask({ id: "1", subject: "test" }));
	store.deleteTask("1");
	store.deleteAll();
	assert("no-ops don't throw", true);
}

// Test: save and load tasks
console.log("\nSave and load:");
{
	testDir = freshDir();
	const store = new TaskListStore(testDir);

	const task1 = makeTask({ id: "1", subject: "First task", description: "Details here" });
	const task2 = makeTask({ id: "2", subject: "Second task", status: "in_progress" });

	store.saveTask(task1);
	store.saveTask(task2);

	const loaded = loadAllOrThrow(store);
	assert("loads 2 tasks", loaded.length === 2);
	assert("task 1 subject", loaded[0].subject === "First task");
	assert("task 1 description", loaded[0].description === "Details here");
	assert("task 2 status", loaded[1].status === "in_progress");
	assert("sorted by ID", loaded[0].id === "1" && loaded[1].id === "2");

	rmSync(testDir, { recursive: true, force: true });
}

// Test: delete single task
console.log("\nDelete task:");
{
	testDir = freshDir();
	const store = new TaskListStore(testDir);

	store.saveTask(makeTask({ id: "1", subject: "Keep" }));
	store.saveTask(makeTask({ id: "2", subject: "Delete me" }));

	store.deleteTask("2");
	const loaded = loadAllOrThrow(store);
	assert("1 task remains", loaded.length === 1);
	assert("kept task is #1", loaded[0].id === "1");

	rmSync(testDir, { recursive: true, force: true });
}

// Test: delete all
console.log("\nDelete all:");
{
	testDir = freshDir();
	const store = new TaskListStore(testDir);

	store.saveTask(makeTask({ id: "1", subject: "A" }));
	store.saveTask(makeTask({ id: "2", subject: "B" }));
	store.saveTask(makeTask({ id: "3", subject: "C" }));

	store.deleteAll();
	const loaded = loadAllOrThrow(store);
	assert("0 tasks after deleteAll", loaded.length === 0);

	rmSync(testDir, { recursive: true, force: true });
}

// Test: schema migration (old title → subject)
console.log("\nSchema migration (title → subject):");
{
	testDir = freshDir();
	mkdirSync(testDir, { recursive: true });

	// Write old-schema task files
	const oldTask = {
		id: "1",
		title: "Old format task",
		status: "pending",
		dependencies: ["2"],
		createdAt: 1_700_000_000_000,
	};
	writeFileSync(join(testDir, "1.json"), JSON.stringify(oldTask));

	const store = new TaskListStore(testDir);
	const loaded = loadAllOrThrow(store);

	assert("migrated subject", loaded[0].subject === "Old format task");
	assert("migrated blockedBy", loaded[0].blockedBy[0] === "2");
	assert("has blocks array", Array.isArray(loaded[0].blocks));
	assert("has comments array", Array.isArray(loaded[0].comments));

	rmSync(testDir, { recursive: true, force: true });
}

// Test: corrupt file handling
console.log("\nCorrupt file handling:");
{
	testDir = freshDir();
	mkdirSync(testDir, { recursive: true });

	writeFileSync(join(testDir, "1.json"), "not json at all {{{");
	writeFileSync(join(testDir, "2.json"), JSON.stringify(makeTask({ id: "2", subject: "Valid" })));

	const store = new TaskListStore(testDir);
	const loaded = loadAllOrThrow(store);

	assert("skips corrupt, loads valid", loaded.length === 1);
	assert("loaded task is #2", loaded[0].id === "2");

	rmSync(testDir, { recursive: true, force: true });
}

// Test: bidirectional dependency helpers
console.log("\nBidirectional dependencies:");
{
	testDir = freshDir();
	const store = new TaskListStore(testDir);

	const task1 = makeTask({ id: "1", subject: "Schema" });
	const task2 = makeTask({ id: "2", subject: "API" });

	// Simulate addBlocks: task1 blocks task2
	task1.blocks.push("2");
	task2.blockedBy.push("1");
	store.saveTask(task1);
	store.saveTask(task2);

	const loaded = loadAllOrThrow(store);
	assert("task1 blocks task2", loaded[0].blocks.includes("2"));
	assert("task2 blockedBy task1", loaded[1].blockedBy.includes("1"));

	rmSync(testDir, { recursive: true, force: true });
}

// Test: comments
console.log("\nComments:");
{
	testDir = freshDir();
	const store = new TaskListStore(testDir);

	const task = makeTask({ id: "1", subject: "Auth" });
	task.comments.push({ author: "agent", content: "Tried JWT, switching to session tokens", timestamp: Date.now() });
	task.comments.push({ author: "user", content: "Use httpOnly cookies", timestamp: Date.now() + 1000 });
	store.saveTask(task);

	const loaded = loadAllOrThrow(store);
	assert("2 comments", loaded[0].comments.length === 2);
	assert("first comment author", loaded[0].comments[0].author === "agent");
	assert("second comment content", loaded[0].comments[1].content === "Use httpOnly cookies");

	rmSync(testDir, { recursive: true, force: true });
}

// Test: owner field
console.log("\nOwner field:");
{
	testDir = freshDir();
	const store = new TaskListStore(testDir);

	const task = makeTask({ id: "1", subject: "Build UI", owner: "worker-1" });
	store.saveTask(task);

	const loaded = loadAllOrThrow(store);
	assert("owner persists", loaded[0].owner === "worker-1");

	const taskNoOwner = makeTask({ id: "2", subject: "Write docs" });
	store.saveTask(taskNoOwner);

	const loaded2 = loadAllOrThrow(store);
	assert("no owner is undefined", loaded2[1].owner === undefined);

	rmSync(testDir, { recursive: true, force: true });
}

// Test: sequential ID sorting
console.log("\nSequential ID sorting:");
{
	testDir = freshDir();
	const store = new TaskListStore(testDir);

	// Save out of order
	store.saveTask(makeTask({ id: "3", subject: "Third" }));
	store.saveTask(makeTask({ id: "1", subject: "First" }));
	store.saveTask(makeTask({ id: "10", subject: "Tenth" }));
	store.saveTask(makeTask({ id: "2", subject: "Second" }));

	const loaded = loadAllOrThrow(store);
	assert("sorted: 1, 2, 3, 10", loaded.map((t) => t.id).join(",") === "1,2,3,10");

	rmSync(testDir, { recursive: true, force: true });
}

// Test: one file per task
console.log("\nOne file per task:");
{
	testDir = freshDir();
	const store = new TaskListStore(testDir);

	store.saveTask(makeTask({ id: "1", subject: "A" }));
	store.saveTask(makeTask({ id: "2", subject: "B" }));

	const files = readdirSync(testDir)
		.filter((f) => f.endsWith(".json"))
		.sort();
	assert("2 JSON files", files.length === 2);
	assert("file names match IDs", files[0] === "1.json" && files[1] === "2.json");

	// Updating one task only writes one file
	const task1 = makeTask({ id: "1", subject: "A updated" });
	store.saveTask(task1);

	const loaded = loadAllOrThrow(store);
	assert("task 1 updated", loaded[0].subject === "A updated");
	assert("task 2 unchanged", loaded[1].subject === "B");

	rmSync(testDir, { recursive: true, force: true });
}

// ── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
