import { randomUUID } from "node:crypto";

export type FullSubagentState = "starting" | "idle" | "busy" | "compacting" | "awaiting_user" | "error" | "dead";
export type FullSubagentMessageType =
	| "ready"
	| "heartbeat"
	| "status"
	| "tool_event"
	| "message_delta"
	| "task.start"
	| "task.cancel"
	| "task.done"
	| "task.error"
	| "compact.request"
	| "shutdown";

export interface FullSubagentProtocolMessage {
	protocolVersion: 1;
	agentId: string;
	type: FullSubagentMessageType;
	timestamp: number;
	requestId?: string;
	[key: string]: unknown;
}

export interface FullSubagentTransport {
	onMessage(handler: (line: string) => void): void;
	onExit(handler: (code: number | null) => void): void;
	send(line: string): void;
	kill(): void;
}

export interface FullSubagentRuntimeConfig {
	agentId: string;
	agentName: string;
	model?: string;
	transport: FullSubagentTransport;
}

export interface FullSubagentSnapshot {
	agentId: string;
	agentName: string;
	model?: string;
	state: FullSubagentState;
	activity: string;
	requestId?: string;
	contextTokens: number;
	contextWindow: number;
	contextPercent: number;
	compactCount: number;
	lastResult?: string;
	lastError?: string;
	lastHeartbeatAt?: number;
}

interface RuntimeRecord {
	config: FullSubagentRuntimeConfig;
	snapshot: FullSubagentSnapshot;
}

export interface PiChildArgsInput {
	agentName: string;
	model?: string;
	tools: string[];
	cwd: string;
}

export function buildPiChildArgs(input: PiChildArgsInput): string[] {
	const args = ["--mode", "json", "-p", "--no-session"];
	if (input.model) args.push("--model", input.model);
	if (input.tools.length > 0) args.push("--tools", input.tools.join(","));
	args.push(`Full subagent ${input.agentName} ready. Wait for task protocol messages from parent.`);
	return args;
}

export function createProtocolMessage(
	agentId: string,
	type: FullSubagentMessageType,
	payload: Record<string, unknown> = {},
): FullSubagentProtocolMessage {
	return {
		protocolVersion: 1,
		agentId,
		type,
		timestamp: Date.now(),
		...payload,
	};
}

function serializeProtocolLine(message: FullSubagentProtocolMessage): string {
	return `${JSON.stringify(message)}\n`;
}

export function parseProtocolLine(line: string): FullSubagentProtocolMessage {
	let parsed: unknown;
	try {
		parsed = JSON.parse(line.trim());
	} catch {
		throw new Error("Invalid protocol JSON");
	}
	if (
		typeof parsed !== "object" ||
		parsed === null ||
		Array.isArray(parsed) ||
		(parsed as Record<string, unknown>).protocolVersion !== 1 ||
		typeof (parsed as Record<string, unknown>).agentId !== "string" ||
		typeof (parsed as Record<string, unknown>).type !== "string" ||
		typeof (parsed as Record<string, unknown>).timestamp !== "number"
	) {
		throw new Error("Invalid protocol message");
	}
	return parsed as FullSubagentProtocolMessage;
}

function contextPercent(tokens: number, window: number): number {
	if (window <= 0) return 0;
	return Math.max(0, Math.min(100, Math.round((tokens / window) * 100)));
}

function textValue(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stateValue(value: unknown, fallback: FullSubagentState): FullSubagentState {
	return ["starting", "idle", "busy", "compacting", "awaiting_user", "error", "dead"].includes(String(value))
		? (value as FullSubagentState)
		: fallback;
}

export class FullSubagentPool {
	private readonly runtimes = new Map<string, RuntimeRecord>();

	constructor(configs: FullSubagentRuntimeConfig[]) {
		for (const config of configs) {
			const snapshot: FullSubagentSnapshot = {
				agentId: config.agentId,
				agentName: config.agentName,
				model: config.model,
				state: "starting",
				activity: "starting",
				contextTokens: 0,
				contextWindow: 0,
				contextPercent: 0,
				compactCount: 0,
			};
			this.runtimes.set(config.agentId, { config, snapshot });
			config.transport.onMessage((line) => this.handleLine(config.agentId, line));
			config.transport.onExit(() => this.markDead(config.agentId));
		}
	}

	getSnapshot(): FullSubagentSnapshot[] {
		return Array.from(this.runtimes.values()).map((runtime) => ({ ...runtime.snapshot }));
	}

	startTask(agentId: string, task: string, cwd: string): string {
		const runtime = this.requireRuntime(agentId);
		const requestId = randomUUID();
		runtime.snapshot.state = "busy";
		runtime.snapshot.activity = task;
		runtime.snapshot.requestId = requestId;
		runtime.config.transport.send(serializeProtocolLine(createProtocolMessage(agentId, "task.start", { requestId, task, cwd })));
		return requestId;
	}

	cancelTask(agentId: string, reason: string): void {
		const runtime = this.requireRuntime(agentId);
		runtime.config.transport.send(serializeProtocolLine(createProtocolMessage(agentId, "task.cancel", {
			requestId: runtime.snapshot.requestId,
			reason,
		})));
	}

	shutdown(): void {
		for (const runtime of this.runtimes.values()) {
			runtime.config.transport.send(serializeProtocolLine(createProtocolMessage(runtime.config.agentId, "shutdown")));
			runtime.config.transport.kill();
		}
	}

	private requireRuntime(agentId: string): RuntimeRecord {
		const runtime = this.runtimes.get(agentId);
		if (!runtime) throw new Error(`Unknown full subagent: ${agentId}`);
		return runtime;
	}

	private markDead(agentId: string): void {
		const runtime = this.runtimes.get(agentId);
		if (!runtime) return;
		runtime.snapshot.state = "dead";
		runtime.snapshot.activity = "process exited";
	}

	private handleLine(agentId: string, line: string): void {
		const message = parseProtocolLine(line);
		const runtime = this.requireRuntime(agentId);
		if (message.agentId !== agentId) throw new Error(`Mismatched agent id: ${message.agentId}`);
		if (message.type === "ready") {
			runtime.snapshot.state = stateValue(message.state, "idle");
			runtime.snapshot.activity = "idle";
		}
		if (message.type === "heartbeat") {
			runtime.snapshot.lastHeartbeatAt = message.timestamp;
		}
		if (message.type === "status") {
			runtime.snapshot.state = stateValue(message.state, runtime.snapshot.state);
			runtime.snapshot.activity = textValue(message.activity) ?? runtime.snapshot.activity;
			runtime.snapshot.contextTokens = numberValue(message.contextTokens, runtime.snapshot.contextTokens);
			runtime.snapshot.contextWindow = numberValue(message.contextWindow, runtime.snapshot.contextWindow);
			runtime.snapshot.contextPercent = contextPercent(runtime.snapshot.contextTokens, runtime.snapshot.contextWindow);
			runtime.snapshot.compactCount = numberValue(message.compactCount, runtime.snapshot.compactCount);
		}
		if (message.type === "task.done") {
			runtime.snapshot.state = "idle";
			runtime.snapshot.activity = "idle";
			runtime.snapshot.requestId = undefined;
			runtime.snapshot.lastResult = textValue(message.text) ?? "done";
		}
		if (message.type === "task.error") {
			runtime.snapshot.state = "error";
			runtime.snapshot.activity = "error";
			runtime.snapshot.requestId = undefined;
			runtime.snapshot.lastError = textValue(message.error) ?? "task failed";
		}
	}
}
