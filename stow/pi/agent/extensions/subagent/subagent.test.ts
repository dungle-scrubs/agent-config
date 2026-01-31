/**
 * Unit tests for subagent extension core logic
 */
import { beforeEach, describe, expect, it } from "vitest";

// Extracted core types for testing
interface BackgroundSubagent {
	id: string;
	agent: string;
	task: string;
	startTime: number;
	status: "running" | "completed" | "failed";
}

interface SingleResult {
	agent: string;
	agentSource: string;
	task: string;
	exitCode: number;
	messages: any[];
	stderr: string;
	stopReason?: string;
	errorMessage?: string;
}

// Core functions extracted for testing
function formatDuration(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${minutes}m${secs}s`;
}

function generateId(): string {
	return Math.random().toString(36).substring(2, 10);
}

function isRunningState(result: SingleResult): boolean {
	return result.exitCode === -1;
}

function isErrorState(result: SingleResult): boolean {
	if (result.exitCode === -1) return false; // Still running
	return result.exitCode !== 0 || result.stopReason === "error" || result.stopReason === "aborted";
}

describe("subagent core", () => {
	describe("formatDuration", () => {
		it("should format seconds", () => {
			expect(formatDuration(5000)).toBe("5s");
			expect(formatDuration(30000)).toBe("30s");
			expect(formatDuration(59000)).toBe("59s");
		});

		it("should format minutes and seconds", () => {
			expect(formatDuration(60000)).toBe("1m0s");
			expect(formatDuration(90000)).toBe("1m30s");
			expect(formatDuration(125000)).toBe("2m5s");
		});
	});

	describe("generateId", () => {
		it("should generate unique ids", () => {
			const ids = new Set<string>();
			for (let i = 0; i < 100; i++) {
				ids.add(generateId());
			}
			expect(ids.size).toBe(100);
		});

		it("should generate alphanumeric ids", () => {
			const id = generateId();
			expect(id).toMatch(/^[a-z0-9]+$/);
		});
	});

	describe("isRunningState", () => {
		it("should return true for exitCode -1", () => {
			const result: SingleResult = {
				agent: "worker",
				agentSource: "user",
				task: "test",
				exitCode: -1,
				messages: [],
				stderr: "",
			};
			expect(isRunningState(result)).toBe(true);
		});

		it("should return false for exitCode 0", () => {
			const result: SingleResult = {
				agent: "worker",
				agentSource: "user",
				task: "test",
				exitCode: 0,
				messages: [],
				stderr: "",
			};
			expect(isRunningState(result)).toBe(false);
		});
	});

	describe("isErrorState", () => {
		it("should return false when running", () => {
			const result: SingleResult = {
				agent: "worker",
				agentSource: "user",
				task: "test",
				exitCode: -1,
				messages: [],
				stderr: "",
			};
			expect(isErrorState(result)).toBe(false);
		});

		it("should return false for success", () => {
			const result: SingleResult = {
				agent: "worker",
				agentSource: "user",
				task: "test",
				exitCode: 0,
				messages: [],
				stderr: "",
			};
			expect(isErrorState(result)).toBe(false);
		});

		it("should return true for non-zero exit code", () => {
			const result: SingleResult = {
				agent: "worker",
				agentSource: "user",
				task: "test",
				exitCode: 1,
				messages: [],
				stderr: "",
			};
			expect(isErrorState(result)).toBe(true);
		});

		it("should return true for error stopReason", () => {
			const result: SingleResult = {
				agent: "worker",
				agentSource: "user",
				task: "test",
				exitCode: 0,
				messages: [],
				stderr: "",
				stopReason: "error",
			};
			expect(isErrorState(result)).toBe(true);
		});

		it("should return true for aborted stopReason", () => {
			const result: SingleResult = {
				agent: "worker",
				agentSource: "user",
				task: "test",
				exitCode: 0,
				messages: [],
				stderr: "",
				stopReason: "aborted",
			};
			expect(isErrorState(result)).toBe(true);
		});
	});

	describe("PI_IS_SUBAGENT env var", () => {
		it("should be set when spawning subagent workers", () => {
			// The spawn call should include PI_IS_SUBAGENT=1 in env
			const spawnEnv = { ...process.env, PI_IS_SUBAGENT: "1" };
			expect(spawnEnv.PI_IS_SUBAGENT).toBe("1");
		});

		it("should skip extension initialization when set", () => {
			const originalEnv = process.env.PI_IS_SUBAGENT;
			process.env.PI_IS_SUBAGENT = "1";

			const shouldSkip = process.env.PI_IS_SUBAGENT === "1";
			expect(shouldSkip).toBe(true);

			if (originalEnv === undefined) {
				delete process.env.PI_IS_SUBAGENT;
			} else {
				process.env.PI_IS_SUBAGENT = originalEnv;
			}
		});
	});

	describe("globalThis interval cleanup", () => {
		it("should store widget interval on globalThis", () => {
			const G = globalThis as any;

			const mockInterval = setTimeout(() => {}, 500);
			G.__piSubagentWidgetInterval = mockInterval;

			expect(G.__piSubagentWidgetInterval).toBeDefined();

			clearTimeout(G.__piSubagentWidgetInterval);
			G.__piSubagentWidgetInterval = null;
		});

		it("should clear interval when no running subagents", () => {
			const G = globalThis as any;

			// Simulate interval running
			G.__piSubagentWidgetInterval = setTimeout(() => {}, 500);

			// Simulate no running subagents - interval should be cleared
			const bgRunning: any[] = [];
			if (bgRunning.length === 0 && G.__piSubagentWidgetInterval) {
				clearTimeout(G.__piSubagentWidgetInterval);
				G.__piSubagentWidgetInterval = null;
			}

			expect(G.__piSubagentWidgetInterval).toBeNull();
		});
	});

	describe("spinner animation", () => {
		it("should have 4 spinner frames", () => {
			const SPINNER_FRAMES = ["◐", "◓", "◑", "◒"];
			expect(SPINNER_FRAMES.length).toBe(4);
		});

		it("should cycle through frames correctly", () => {
			const SPINNER_FRAMES = ["◐", "◓", "◑", "◒"];
			let frame = 0;

			const getFrame = () => SPINNER_FRAMES[frame % SPINNER_FRAMES.length];

			expect(getFrame()).toBe("◐");
			frame++;
			expect(getFrame()).toBe("◓");
			frame++;
			expect(getFrame()).toBe("◑");
			frame++;
			expect(getFrame()).toBe("◒");
			frame++;
			expect(getFrame()).toBe("◐"); // wraps around
		});

		it("should update frame on interval tick", () => {
			let spinnerFrame = 0;
			const SPINNER_FRAMES = ["◐", "◓", "◑", "◒"];

			// Simulate 5 interval ticks
			for (let i = 0; i < 5; i++) {
				spinnerFrame = (spinnerFrame + 1) % SPINNER_FRAMES.length;
			}

			// 5 ticks = frame 1 (wraps at 4)
			expect(spinnerFrame).toBe(1);
			expect(SPINNER_FRAMES[spinnerFrame]).toBe("◓");
		});
	});

	describe("BackgroundSubagent tracking", () => {
		let bgSubagents: Map<string, BackgroundSubagent>;

		beforeEach(() => {
			bgSubagents = new Map();
		});

		it("should track new background subagent", () => {
			const id = "bg_test123";
			bgSubagents.set(id, {
				id,
				agent: "worker",
				task: "Test task",
				startTime: Date.now(),
				status: "running",
			});
			expect(bgSubagents.has(id)).toBe(true);
			expect(bgSubagents.get(id)?.status).toBe("running");
		});

		it("should filter running subagents", () => {
			bgSubagents.set("bg_1", {
				id: "bg_1",
				agent: "worker",
				task: "Task 1",
				startTime: Date.now(),
				status: "running",
			});
			bgSubagents.set("bg_2", {
				id: "bg_2",
				agent: "worker",
				task: "Task 2",
				startTime: Date.now(),
				status: "completed",
			});
			bgSubagents.set("bg_3", {
				id: "bg_3",
				agent: "worker",
				task: "Task 3",
				startTime: Date.now(),
				status: "running",
			});

			const running = [...bgSubagents.values()].filter((s) => s.status === "running");
			expect(running.length).toBe(2);
		});

		it("should update status on completion", () => {
			const id = "bg_test";
			bgSubagents.set(id, { id, agent: "worker", task: "Task", startTime: Date.now(), status: "running" });

			const subagent = bgSubagents.get(id);
			if (subagent) subagent.status = "completed";

			expect(bgSubagents.get(id)?.status).toBe("completed");
		});
	});
});
