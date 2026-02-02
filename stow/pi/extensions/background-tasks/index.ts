/**
 * Background Tasks Extension for Pi
 *
 * Enables running bash commands in the background, similar to Claude Code.
 *
 * Features:
 * - `bg_bash` tool: Run commands in background, returns task ID immediately
 * - `task_output` tool: Retrieve output from a background task
 * - `task_status` tool: Check if a task is running or completed
 * - `/bg` command: List and manage background tasks
 * - Status widget shows running background tasks
 *
 * Usage:
 *   Ask the agent to "run npm test in the background"
 *   Or use the bg_bash tool directly with a command
 */

import { type ChildProcess, spawn } from "node:child_process";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Key, matchesKey, truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";

// ANSI escape codes for Catppuccin Macchiato colors (medium-dark variant)
// Crust bg: #181926, Mauve: #c6a0f6, Text: #cad3f5
const BG_DARK_GRAY = "\x1b[48;2;24;25;38m"; // Catppuccin Macchiato crust #181926
const FG_PURPLE = "\x1b[38;2;198;160;246m"; // Catppuccin Macchiato mauve #c6a0f6
const FG_PURPLE_MUTED = "\x1b[38;2;165;173;203m"; // Catppuccin Macchiato subtext0 #a5adcb
const FG_LIGHT_GREEN = "\x1b[38;2;166;218;149m"; // Catppuccin Macchiato green #a6da95
const FG_LIGHT_RED = "\x1b[38;2;237;135;150m"; // Catppuccin Macchiato red #ed8796
const FG_WHITE = "\x1b[38;2;202;211;245m"; // Catppuccin Macchiato text #cad3f5
const RESET_ALL = "\x1b[0m";

/** Apply dark blue background with light text to a line, padding to full width */
function withDarkBlueBg(line: string, width: number): string {
	const visLen = visibleWidth(line);
	const padding = " ".repeat(Math.max(0, width - visLen));
	// Reset any existing colors, then apply dark blue bg + white text
	return `${RESET_ALL}${BG_DARK_GRAY}${FG_WHITE}${line}${padding}${RESET_ALL}`;
}

interface BackgroundTask {
	id: string;
	command: string;
	cwd: string;
	startTime: number;
	endTime?: number;
	exitCode?: number | null;
	output: string[];
	outputBytes: number;
	process: ChildProcess | null;
	status: "running" | "completed" | "failed" | "killed";
}

const MAX_OUTPUT_BYTES = 1024 * 1024; // 1MB max buffered output per task
const MAX_TASKS = 20; // Max concurrent/recent tasks

// Global task registry (exposed via globalThis for tasks extension to read)
const tasks = new Map<string, BackgroundTask>();
(globalThis as any).__piBackgroundTasks = tasks;
let taskCounter = 0;

function generateTaskId(): string {
	taskCounter++;
	return `bg_${taskCounter}_${Date.now().toString(36)}`;
}

function cleanupOldTasks(): void {
	if (tasks.size <= MAX_TASKS) return;

	// Remove oldest completed tasks
	const completed = [...tasks.entries()]
		.filter(([_, t]) => t.status !== "running")
		.sort((a, b) => (a[1].endTime || 0) - (b[1].endTime || 0));

	while (tasks.size > MAX_TASKS && completed.length > 0) {
		const entry = completed.shift();
		if (entry) tasks.delete(entry[0]);
	}
}

function formatDuration(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	const secs = seconds % 60;
	if (minutes < 60) return `${minutes}m ${secs}s`;
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	return `${hours}h ${mins}m`;
}

function truncateCommand(cmd: string, maxLen = 40): string {
	if (cmd.length <= maxLen) return cmd;
	return `${cmd.substring(0, maxLen - 3)}...`;
}

export default function backgroundTasksExtension(pi: ExtensionAPI): void {
	// Update status widget (widget rendering delegated to tasks extension via __piBackgroundTasks)
	function updateWidget(ctx: ExtensionContext): void {
		const running = [...tasks.values()].filter((t) => t.status === "running");

		if (running.length === 0) {
			ctx.ui.setStatus("bg-tasks", undefined);
			return;
		}

		// Status bar only - widget is rendered by tasks extension
		ctx.ui.setStatus("bg-tasks", `${FG_PURPLE}⚙ ${running.length} bg${RESET_ALL}`);
	}

	// Tool: Run bash in background
	pi.registerTool({
		name: "bg_bash",
		label: "Background Bash",
		description:
			"Run a bash command in the background. Returns immediately with a task ID. Use task_output to retrieve the output later. Good for long-running commands like builds, tests, or servers.\n\nWHEN TO USE:\n- Starting daemons or servers\n- Long-running builds or tests\n- Any process you want to run independently\n\nWARNING: Never use bash tool with & to background processes - it will hang. Use bg_bash instead.",
		parameters: Type.Object({
			command: Type.String({ description: "Bash command to run in background" }),
			timeout: Type.Optional(Type.Number({ description: "Timeout in seconds (optional, default: no timeout)" })),
		}),
		async execute(_toolCallId, params, _onUpdate, ctx, _signal) {
			const taskId = generateTaskId();
			const cwd = ctx.cwd;

			const task: BackgroundTask = {
				id: taskId,
				command: params.command,
				cwd,
				startTime: Date.now(),
				output: [],
				outputBytes: 0,
				process: null,
				status: "running",
			};

			// Spawn the process
			const shell = process.env.SHELL || "/bin/bash";
			const child = spawn(shell, ["-c", params.command], {
				cwd,
				stdio: ["ignore", "pipe", "pipe"],
				detached: true,
			});

			task.process = child;
			tasks.set(taskId, task);
			cleanupOldTasks();

			// Buffer output
			const onData = (data: Buffer) => {
				if (task.outputBytes < MAX_OUTPUT_BYTES) {
					const text = data.toString();
					task.output.push(text);
					task.outputBytes += data.length;

					if (task.outputBytes >= MAX_OUTPUT_BYTES) {
						task.output.push("\n[Output truncated - max buffer size reached]\n");
					}
				}
			};

			child.stdout?.on("data", onData);
			child.stderr?.on("data", onData);

			// Handle completion
			child.on("close", (code) => {
				task.endTime = Date.now();
				task.exitCode = code;
				task.status = code === 0 ? "completed" : "failed";
				task.process = null;
				updateWidget(ctx);
			});

			child.on("error", (err) => {
				task.endTime = Date.now();
				task.status = "failed";
				task.output.push(`\nError: ${err.message}\n`);
				task.process = null;
				updateWidget(ctx);
			});

			// Handle timeout
			if (params.timeout && params.timeout > 0) {
				setTimeout(() => {
					if (task.status === "running" && task.process) {
						task.process.kill("SIGTERM");
						task.status = "killed";
						task.output.push(`\n[Killed: timeout after ${params.timeout}s]\n`);
					}
				}, params.timeout * 1000);
			}

			// Unref so it doesn't block exit
			child.unref();

			updateWidget(ctx);

			return {
				details: {},
				content: [
					{
						type: "text",
						text: `Background task started.\nTask ID: ${taskId}\nCommand: ${params.command}\nUse task_output("${taskId}") to retrieve output.`,
					},
				],
			};
		},
	});

	// Tool: Get task output
	pi.registerTool({
		name: "task_output",
		label: "Task Output",
		description:
			"Retrieve the output from a background task. Can be called while task is still running to get partial output.",
		parameters: Type.Object({
			taskId: Type.String({ description: "Task ID returned by bg_bash" }),
			tail: Type.Optional(Type.Number({ description: "Only return last N lines (optional)" })),
		}),
		async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
			const task = tasks.get(params.taskId);

			if (!task) {
				return {
					details: {},
					content: [
						{
							type: "text",
							text: `Task not found: ${params.taskId}\n\nAvailable tasks:\n${[...tasks.keys()].join("\n") || "(none)"}`,
						},
					],
				};
			}

			let output = task.output.join("");

			if (params.tail && params.tail > 0) {
				const lines = output.split("\n");
				output = lines.slice(-params.tail).join("\n");
			}

			const duration = formatDuration((task.endTime || Date.now()) - task.startTime);
			const statusLine =
				task.status === "running"
					? `Status: running (${duration})`
					: `Status: ${task.status} (exit code: ${task.exitCode}, duration: ${duration})`;

			return {
				details: {},
				content: [
					{
						type: "text",
						text: `Task: ${params.taskId}\nCommand: ${task.command}\n${statusLine}\n\n--- Output ---\n${output || "(no output yet)"}`,
					},
				],
			};
		},
	});

	// Tool: Check task status
	pi.registerTool({
		name: "task_status",
		label: "Task Status",
		description: "Check if a background task is still running or has completed.",
		parameters: Type.Object({
			taskId: Type.String({ description: "Task ID returned by bg_bash" }),
		}),
		async execute(_toolCallId, params, _onUpdate, _ctx, _signal) {
			const task = tasks.get(params.taskId);

			if (!task) {
				return {
					details: {},
					content: [
						{
							type: "text",
							text: `Task not found: ${params.taskId}`,
						},
					],
				};
			}

			const duration = formatDuration((task.endTime || Date.now()) - task.startTime);

			return {
				details: {},
				content: [
					{
						type: "text",
						text: JSON.stringify(
							{
								taskId: task.id,
								command: task.command,
								status: task.status,
								exitCode: task.exitCode,
								duration,
								outputBytes: task.outputBytes,
							},
							null,
							2
						),
					},
				],
			};
		},
	});

	// Tool: Kill a background task
	pi.registerTool({
		name: "task_kill",
		label: "Kill Task",
		description: "Kill a running background task.",
		parameters: Type.Object({
			taskId: Type.String({ description: "Task ID to kill" }),
		}),
		async execute(_toolCallId, params, _onUpdate, ctx, _signal) {
			const task = tasks.get(params.taskId);

			if (!task) {
				return {
					details: {},
					content: [{ type: "text", text: `Task not found: ${params.taskId}` }],
				};
			}

			if (task.status !== "running" || !task.process) {
				return {
					details: {},
					content: [{ type: "text", text: `Task ${params.taskId} is not running (status: ${task.status})` }],
				};
			}

			task.process.kill("SIGTERM");
			task.status = "killed";
			task.endTime = Date.now();
			task.output.push("\n[Killed by user]\n");

			updateWidget(ctx);

			return {
				details: {},
				content: [{ type: "text", text: `Killed task ${params.taskId}` }],
			};
		},
	});

	// Command: /bg - List and manage background tasks with interactive viewer
	pi.registerCommand("bg", {
		description: "List and manage background tasks (interactive viewer)",
		handler: async (args, ctx) => {
			const parts = args.trim().split(/\s+/);
			const subcommand = parts[0]?.toLowerCase() || "";
			const rest = parts.slice(1).join(" ");

			// Quick subcommands
			if (subcommand === "kill" && rest) {
				const task = tasks.get(rest);
				if (!task) {
					ctx.ui.notify(`Task not found: ${rest}`, "error");
					return;
				}
				if (task.status !== "running" || !task.process) {
					ctx.ui.notify(`Task ${rest} is not running`, "error");
					return;
				}
				task.process.kill("SIGTERM");
				task.status = "killed";
				task.endTime = Date.now();
				updateWidget(ctx);
				ctx.ui.notify(`Killed task ${rest}`, "info");
				return;
			}

			if (subcommand === "clear") {
				const completed = [...tasks.entries()].filter(([_, t]) => t.status !== "running");
				for (const [id] of completed) {
					tasks.delete(id);
				}
				updateWidget(ctx);
				ctx.ui.notify(`Cleared ${completed.length} completed tasks`, "info");
				return;
			}

			// No tasks? Show message
			if (tasks.size === 0) {
				ctx.ui.notify(
					"No background tasks.\n\n" +
						"To run a command in background, ask the agent to use bg_bash,\n" +
						"or say 'run [command] in the background'.",
					"info"
				);
				return;
			}

			// Hide the widget and status BEFORE opening the viewer (avoid duplication)
			ctx.ui.setWidget("bg-tasks", undefined);
			ctx.ui.setStatus("bg-tasks", undefined);

			// Interactive task viewer
			await ctx.ui.custom<void>((tui, theme, _kb, done) => {
				type ViewMode = "list" | "output";
				let mode: ViewMode = "list";
				let selectedIndex = 0;
				let selectedTaskId: string | null = null;
				let scrollOffset = 0;
				let cachedLines: string[] | undefined;
				let refreshInterval: NodeJS.Timeout | null = null;

				// Start auto-refresh for live output
				refreshInterval = setInterval(() => {
					cachedLines = undefined;
					tui.requestRender();
				}, 500);

				function getTaskList(): BackgroundTask[] {
					return [...tasks.values()].sort((a, b) => b.startTime - a.startTime);
				}

				function refresh() {
					cachedLines = undefined;
					tui.requestRender();
				}

				function cleanup() {
					if (refreshInterval) {
						clearInterval(refreshInterval);
						refreshInterval = null;
					}
					// Restore the widget when closing the viewer
					updateWidget(ctx);
				}

				function handleInput(data: string) {
					const taskList = getTaskList();

					if (mode === "list") {
						// List mode navigation
						if (matchesKey(data, Key.up)) {
							selectedIndex = Math.max(0, selectedIndex - 1);
							refresh();
							return true;
						}
						if (matchesKey(data, Key.down)) {
							selectedIndex = Math.min(taskList.length - 1, selectedIndex + 1);
							refresh();
							return true;
						}
						if (matchesKey(data, Key.enter)) {
							if (taskList.length > 0) {
								selectedTaskId = taskList[selectedIndex].id;
								mode = "output";
								scrollOffset = 0;
								refresh();
							}
							return true;
						}
						if (matchesKey(data, Key.escape) || matchesKey(data, "q")) {
							cleanup();
							done();
							return true;
						}
						// Kill with 'k' or 'x'
						if ((data === "k" || data === "x") && taskList.length > 0) {
							const task = taskList[selectedIndex];
							if (task.status === "running" && task.process) {
								task.process.kill("SIGTERM");
								task.status = "killed";
								task.endTime = Date.now();
								refresh();
							}
							return true;
						}
					} else if (mode === "output") {
						// Output view navigation
						if (matchesKey(data, Key.escape) || matchesKey(data, "q") || matchesKey(data, Key.left)) {
							mode = "list";
							selectedTaskId = null;
							refresh();
							return true;
						}
						if (matchesKey(data, Key.up)) {
							scrollOffset = Math.max(0, scrollOffset - 1);
							refresh();
							return true;
						}
						if (matchesKey(data, Key.down)) {
							scrollOffset++;
							refresh();
							return true;
						}
						if (matchesKey(data, Key.pageUp)) {
							scrollOffset = Math.max(0, scrollOffset - 10);
							refresh();
							return true;
						}
						if (matchesKey(data, Key.pageDown)) {
							scrollOffset += 10;
							refresh();
							return true;
						}
						// Kill with 'k' or 'x'
						if ((data === "k" || data === "x") && selectedTaskId) {
							const task = tasks.get(selectedTaskId);
							if (task && task.status === "running" && task.process) {
								task.process.kill("SIGTERM");
								task.status = "killed";
								task.endTime = Date.now();
								refresh();
							}
							return true;
						}
						// 'g' to go to top, 'G' to go to bottom
						if (data === "g") {
							scrollOffset = 0;
							refresh();
							return true;
						}
						if (data === "G") {
							scrollOffset = 99999; // Will be clamped in render
							refresh();
							return true;
						}
					}
					return true;
				}

				function render(width: number): string[] {
					if (cachedLines && cachedLines.length > 0) return cachedLines;

					const rawLines: string[] = [];
					const height = tui.terminal.rows - 4; // Leave room for header/footer
					const taskList = getTaskList();

					if (mode === "list") {
						// Header - light blue on dark blue bg
						rawLines.push(
							`${FG_PURPLE_MUTED}${theme.bold(" Background Tasks")} (${taskList.length})${RESET_ALL}${BG_DARK_GRAY}${FG_WHITE}`
						);
						rawLines.push("");

						// Task list - light colors for contrast on dark blue bg
						for (let i = 0; i < taskList.length; i++) {
							const task = taskList[i];
							const isSelected = i === selectedIndex;
							const duration = formatDuration((task.endTime || Date.now()) - task.startTime);

							let statusIcon: string;
							let iconColor: string;
							switch (task.status) {
								case "running":
									statusIcon = "●";
									iconColor = FG_PURPLE; // Light blue dot
									break;
								case "completed":
									statusIcon = "✓";
									iconColor = FG_LIGHT_GREEN; // Light green
									break;
								case "killed":
									statusIcon = "✗";
									iconColor = FG_LIGHT_RED; // Light red
									break;
								default:
									statusIcon = "!";
									iconColor = FG_LIGHT_RED;
							}

							const prefix = isSelected ? `${FG_PURPLE} > ${RESET_ALL}${BG_DARK_GRAY}${FG_WHITE}` : "   ";
							const icon = `${iconColor}${statusIcon}${RESET_ALL}${BG_DARK_GRAY}${FG_WHITE}`;
							const cmd = truncateCommand(task.command, width - 30);
							const info = ` [${task.status}, ${duration}]`;

							if (isSelected) {
								rawLines.push(`${prefix + icon} ${FG_PURPLE}${cmd}${RESET_ALL}${BG_DARK_GRAY}${FG_WHITE}${info}`);
							} else {
								rawLines.push(`${prefix + icon} ${cmd}${info}`);
							}
						}

						rawLines.push("");
						rawLines.push(" ↑↓ navigate • Enter view output • k kill • q close");
					} else if (mode === "output" && selectedTaskId) {
						const task = tasks.get(selectedTaskId);
						if (!task) {
							mode = "list";
							return render(width);
						}

						const duration = formatDuration((task.endTime || Date.now()) - task.startTime);
						let statusText: string;
						switch (task.status) {
							case "running":
								statusText = `${FG_PURPLE}● RUNNING${RESET_ALL}${BG_DARK_GRAY}${FG_WHITE}`;
								break;
							case "completed":
								statusText = `${FG_LIGHT_GREEN}✓ COMPLETED${RESET_ALL}${BG_DARK_GRAY}${FG_WHITE}`;
								break;
							case "killed":
								statusText = `${FG_LIGHT_RED}✗ KILLED${RESET_ALL}${BG_DARK_GRAY}${FG_WHITE}`;
								break;
							default:
								statusText = `${FG_LIGHT_RED}! FAILED${RESET_ALL}${BG_DARK_GRAY}${FG_WHITE}`;
						}

						// Header - light blue on dark blue
						rawLines.push(
							`${FG_PURPLE}${theme.bold(" Task Output")}${RESET_ALL}${BG_DARK_GRAY}${FG_WHITE}  ${statusText} (${duration})`
						);
						rawLines.push(` ${truncateCommand(task.command, width - 4)}`);
						rawLines.push("");

						// Output content
						const outputText = task.output.join("");
						const outputLines = outputText.split("\n");

						// Clamp scroll offset
						const maxScroll = Math.max(0, outputLines.length - (height - 8));
						scrollOffset = Math.min(scrollOffset, maxScroll);

						const visibleLines = outputLines.slice(scrollOffset, scrollOffset + height - 8);

						if (visibleLines.length === 0) {
							rawLines.push(" (no output yet)");
						} else {
							for (const line of visibleLines) {
								rawLines.push(` ${truncateToWidth(line, width - 2)}`);
							}
						}

						// Scroll indicator
						if (outputLines.length > height - 8) {
							const scrollPct = Math.round((scrollOffset / maxScroll) * 100);
							rawLines.push("");
							rawLines.push(
								` [${scrollOffset + 1}-${Math.min(scrollOffset + height - 8, outputLines.length)}/${outputLines.length}] ${scrollPct}%`
							);
						}

						rawLines.push("");
						const killHint = task.status === "running" ? " • k kill" : "";
						rawLines.push(` Esc/q back • ↑↓ scroll • g/G top/bottom${killHint}`);
					}

					// Apply dark blue background to all lines
					cachedLines = rawLines.map((line) => withDarkBlueBg(line, width));
					return cachedLines;
				}

				return {
					render,
					invalidate: () => {
						cachedLines = undefined;
					},
					handleInput,
				};
			});

			updateWidget(ctx);
		},
	});

	// Cleanup on session end
	pi.on("session_shutdown", async () => {
		// Kill all running tasks
		for (const task of tasks.values()) {
			if (task.status === "running" && task.process) {
				task.process.kill("SIGTERM");
			}
		}
		tasks.clear();
	});

	// Update status on session start (widget rendering delegated to tasks extension)
	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.setStatus("bg-tasks", undefined);
		updateWidget(ctx);
	});

	// Register Ctrl+Shift+B shortcut for background tasks
	// Note: only works when TUI is idle, not during tool execution
	pi.registerShortcut(Key.ctrlShift("b"), {
		description: "Show background tasks (Note: use bg_bash tool to run commands in background)",
		handler: async (ctx) => {
			const running = [...tasks.values()].filter((t) => t.status === "running");

			if (running.length === 0) {
				ctx.ui.notify(
					"No background tasks running.\n\n" +
						"To run a command in background, ask the agent to use the bg_bash tool,\n" +
						"or say 'run [command] in the background'.",
					"info"
				);
			} else {
				const lines = running.map((t) => {
					const duration = formatDuration(Date.now() - t.startTime);
					return `● ${t.id}: ${truncateCommand(t.command, 40)} (${duration})`;
				});
				ctx.ui.notify(`Running Background Tasks:\n${lines.join("\n")}`, "info");
			}
		},
	});
}
