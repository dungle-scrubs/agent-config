/**
 * Test utilities for Pi extensions
 */

import { EventEmitter } from "node:events";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { vi } from "vitest";

type EventHandler = (event: any, ctx: ExtensionContext) => Promise<any> | any;

export interface MockExtensionAPI {
	events: EventEmitter;
	handlers: Map<string, EventHandler[]>;
	tools: Map<string, any>;
	commands: Map<string, any>;
	trigger: (event: string, data: any, ctx?: Partial<ExtensionContext>) => Promise<any>;
	on: ReturnType<typeof vi.fn>;
	registerTool: ReturnType<typeof vi.fn>;
	registerCommand: ReturnType<typeof vi.fn>;
	sendMessage: ReturnType<typeof vi.fn>;
	sendUserMessage: ReturnType<typeof vi.fn>;
	appendEntry: ReturnType<typeof vi.fn>;
	setSessionName: ReturnType<typeof vi.fn>;
	getSessionName: ReturnType<typeof vi.fn>;
	setLabel: ReturnType<typeof vi.fn>;
	exec: ReturnType<typeof vi.fn>;
	getActiveTools: ReturnType<typeof vi.fn>;
	getAllTools: ReturnType<typeof vi.fn>;
	setActiveTools: ReturnType<typeof vi.fn>;
	setModel: ReturnType<typeof vi.fn>;
	getThinkingLevel: ReturnType<typeof vi.fn>;
	setThinkingLevel: ReturnType<typeof vi.fn>;
	registerProvider: ReturnType<typeof vi.fn>;
	registerShortcut: ReturnType<typeof vi.fn>;
	registerFlag: ReturnType<typeof vi.fn>;
	getFlag: ReturnType<typeof vi.fn>;
	registerMessageRenderer: ReturnType<typeof vi.fn>;
}

export function createMockExtensionAPI(): MockExtensionAPI {
	const handlers = new Map<string, EventHandler[]>();
	const tools = new Map<string, any>();
	const commands = new Map<string, any>();
	const events = new EventEmitter();

	const mockCtx: ExtensionContext = {
		cwd: "/test/cwd",
		hasUI: false,
		sessionManager: {
			getEntries: () => [],
			getBranch: () => [],
			getLeafId: () => undefined,
			getSessionFile: () => undefined,
		} as any,
		modelRegistry: {} as any,
		model: {} as any,
		ui: {
			notify: vi.fn(),
			confirm: vi.fn().mockResolvedValue(true),
			select: vi.fn(),
			input: vi.fn(),
			editor: vi.fn(),
			setStatus: vi.fn(),
			setWidget: vi.fn(),
			setWorkingMessage: vi.fn(),
			setFooter: vi.fn(),
			setTitle: vi.fn(),
			setEditorText: vi.fn(),
			getEditorText: vi.fn().mockReturnValue(""),
			custom: vi.fn(),
		} as any,
		isIdle: () => true,
		abort: vi.fn(),
		hasPendingMessages: () => false,
		shutdown: vi.fn(),
		getContextUsage: () => undefined,
		compact: vi.fn(),
		getSystemPrompt: () => "",
	};

	const api: MockExtensionAPI = {
		events,
		handlers,
		tools,
		commands,

		on: vi.fn((event: string, handler: EventHandler) => {
			if (!handlers.has(event)) {
				handlers.set(event, []);
			}
			handlers.get(event)!.push(handler);
		}),

		registerTool: vi.fn((tool: any) => {
			tools.set(tool.name, tool);
		}),

		registerCommand: vi.fn((name: string, config: any) => {
			commands.set(name, config);
		}),

		sendMessage: vi.fn(),
		sendUserMessage: vi.fn(),
		appendEntry: vi.fn(),
		setSessionName: vi.fn(),
		getSessionName: vi.fn(),
		setLabel: vi.fn(),
		exec: vi.fn(),
		getActiveTools: vi.fn().mockReturnValue([]),
		getAllTools: vi.fn().mockReturnValue([]),
		setActiveTools: vi.fn(),
		setModel: vi.fn().mockResolvedValue(true),
		getThinkingLevel: vi.fn().mockReturnValue("off"),
		setThinkingLevel: vi.fn(),
		registerProvider: vi.fn(),
		registerShortcut: vi.fn(),
		registerFlag: vi.fn(),
		getFlag: vi.fn(),
		registerMessageRenderer: vi.fn(),

		async trigger(event: string, data: any, ctxOverrides?: Partial<ExtensionContext>) {
			const eventHandlers = handlers.get(event) || [];
			const ctx = { ...mockCtx, ...ctxOverrides };
			let result: any;
			for (const handler of eventHandlers) {
				result = await handler(data, ctx);
				if (result) break; // First handler that returns something wins
			}
			return result;
		},
	};

	return api;
}

export function createMockContext(overrides?: Partial<ExtensionContext>): ExtensionContext {
	return {
		cwd: "/test/cwd",
		hasUI: false,
		sessionManager: {
			getEntries: () => [],
			getBranch: () => [],
			getLeafId: () => undefined,
			getSessionFile: () => undefined,
		} as any,
		modelRegistry: {} as any,
		model: {} as any,
		ui: {
			notify: vi.fn(),
			confirm: vi.fn().mockResolvedValue(true),
			select: vi.fn(),
			input: vi.fn(),
			editor: vi.fn(),
			setStatus: vi.fn(),
			setWidget: vi.fn(),
			setWorkingMessage: vi.fn(),
			setFooter: vi.fn(),
			setTitle: vi.fn(),
			setEditorText: vi.fn(),
			getEditorText: vi.fn().mockReturnValue(""),
			custom: vi.fn(),
		} as any,
		isIdle: () => true,
		abort: vi.fn(),
		hasPendingMessages: () => false,
		shutdown: vi.fn(),
		getContextUsage: () => undefined,
		compact: vi.fn(),
		getSystemPrompt: () => "",
		...overrides,
	};
}
