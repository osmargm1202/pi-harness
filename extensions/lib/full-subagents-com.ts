import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import type { Readable, Writable } from "node:stream";

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

export interface FullSubagentTaskResult {
	requestId: string;
	text: string;
}

export interface FullSubagentTeamResult {
	requestId: string;
	text: string;
	results: Array<FullSubagentTaskResult & { agent: string }>;
}

interface PendingTask {
	resolve: (result: FullSubagentTaskResult) => void;
	reject: (error: Error) => void;
	timeout: ReturnType<typeof setTimeout>;
}

export interface FullSubagentPoolOptions {
	taskTimeoutMs?: number;
}

export const DEFAULT_FULL_SUBAGENT_TASK_TIMEOUT_MS = 30 * 60 * 1000;

export interface PiSubagentTransportInput extends PiChildArgsInput {
	command?: string;
}

export function buildPiChildArgs(input: PiChildArgsInput): string[] {
	const args = ["--mode", "rpc", "--no-session"];
	if (input.model) args.push("--model", input.model);
	if (input.tools.length > 0) args.push("--tools", input.tools.join(","));
	return args;
}

export function buildPiChildEnv(options: { existingEnv?: NodeJS.ProcessEnv } = {}): NodeJS.ProcessEnv {
	const existingEnv = options.existingEnv ?? process.env;
	const currentDepth = Number.parseInt(existingEnv.PI_SUBAGENT_DEPTH ?? "0", 10);
	const nextDepth = Number.isFinite(currentDepth) && currentDepth >= 0 ? currentDepth + 1 : 1;
	return {
		...existingEnv,
		PI_FULL_SUBAGENT_CHILD: "1",
		PI_SUBAGENT_CHILD: "1",
		PI_SUBAGENT_DEPTH: String(nextDepth),
	};
}

interface RpcChildProcessLike {
	stdout: Readable;
	stderr?: Readable;
	stdin: Writable;
	on(event: "exit", handler: (code: number | null) => void): unknown;
	kill(): unknown;
}

export function createPiSubagentTransport(input: PiSubagentTransportInput): FullSubagentTransport {
	const child = spawn(input.command ?? "pi", buildPiChildArgs(input), { cwd: input.cwd, env: buildPiChildEnv() });
	return createPiRpcSubagentTransport(input, child);
}

export function createPiRpcSubagentTransport(input: PiChildArgsInput, child: RpcChildProcessLike): FullSubagentTransport {
	return new PiRpcSubagentTransport(input.agentName, child);
}

class PiRpcSubagentTransport implements FullSubagentTransport {
	private messageHandler: ((line: string) => void) | undefined;
	private activeRequestId: string | undefined;
	private readonly child: RpcChildProcessLike;
	private readonly agentId: string;

	constructor(agentId: string, child: RpcChildProcessLike) {
		this.child = child;
		this.agentId = agentId;
	}

	onMessage(handler: (line: string) => void): void {
		this.messageHandler = handler;
		handler(serializeProtocolLine(createProtocolMessage(this.agentId, "ready", { state: "idle" })));
		let buffer = "";
		this.child.stdout.setEncoding("utf8");
		this.child.stdout.on("data", (chunk: string) => {
			buffer += chunk;
			let newline = buffer.indexOf("\n");
			while (newline >= 0) {
				const line = buffer.slice(0, newline + 1);
				buffer = buffer.slice(newline + 1);
				this.handleRpcLine(line);
				newline = buffer.indexOf("\n");
			}
		});
	}

	onExit(handler: (code: number | null) => void): void {
		this.child.on("exit", handler);
	}

	send(line: string): void {
		let message: FullSubagentProtocolMessage;
		try {
			message = parseProtocolLine(line);
		} catch (error) {
			this.emitProtocol("task.error", { error: error instanceof Error ? error.message : String(error) });
			return;
		}
		if (message.type === "task.start") {
			const requestId = textValue(message.requestId) ?? randomUUID();
			this.activeRequestId = requestId;
			this.child.stdin.write(`${JSON.stringify({
				id: requestId,
				type: "prompt",
				message: formatFullSubagentTaskPrompt(message),
			})}\n`);
			return;
		}
		if (message.type === "task.cancel") {
			this.child.stdin.write(`${JSON.stringify({ id: textValue(message.requestId), type: "abort" })}\n`);
		}
		if (message.type === "shutdown") this.kill();
	}

	kill(): void {
		this.child.kill();
	}

	private emitProtocol(type: FullSubagentMessageType, payload: Record<string, unknown> = {}): void {
		this.messageHandler?.(serializeProtocolLine(createProtocolMessage(this.agentId, type, payload)));
	}

	private handleRpcLine(line: string): void {
		let event: Record<string, unknown>;
		try {
			const parsed = JSON.parse(line.trim());
			if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return;
			event = parsed as Record<string, unknown>;
		} catch (error) {
			this.emitProtocol("task.error", { requestId: this.activeRequestId, error: error instanceof Error ? error.message : String(error) });
			return;
		}
		if (event.type === "response" && event.command === "prompt" && event.success === false) {
			const requestId = textValue(event.id) ?? this.activeRequestId;
			this.emitProtocol("task.error", { requestId, error: textValue(event.error) ?? "prompt failed" });
			this.activeRequestId = undefined;
			return;
		}
		if (event.type === "response" && event.command === "prompt" && event.success === true) {
			this.emitProtocol("status", { requestId: textValue(event.id) ?? this.activeRequestId, state: "busy", activity: "prompt accepted" });
			return;
		}
		if (event.type === "agent_start") {
			this.emitProtocol("status", { requestId: this.activeRequestId, state: "busy", activity: "running" });
			return;
		}
		if (event.type === "extension_ui_request") {
			this.emitProtocol("status", { requestId: this.activeRequestId, state: "awaiting_user", activity: textValue(event.method) ?? "awaiting user" });
			return;
		}
		if (event.type === "agent_end") {
			const requestId = this.activeRequestId;
			this.emitProtocol("task.done", { requestId, text: extractAgentEndText(event) ?? "done" });
			this.activeRequestId = undefined;
		}
	}
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

function formatFullSubagentTaskPrompt(message: FullSubagentProtocolMessage): string {
	return [
		"Full subagent task",
		`Working directory: ${textValue(message.cwd) ?? "(not provided)"}`,
		"",
		"Task:",
		textValue(message.task) ?? "",
	].join("\n");
}

function contentText(value: unknown): string | undefined {
	if (typeof value === "string" && value.trim()) return value.trim();
	if (!Array.isArray(value)) return undefined;
	return value
		.map((chunk) => {
			if (typeof chunk === "string") return chunk;
			if (typeof chunk === "object" && chunk !== null && typeof (chunk as Record<string, unknown>).text === "string") {
				return (chunk as Record<string, string>).text;
			}
			return "";
		})
		.join("")
		.trim() || undefined;
}

function extractAgentEndText(event: Record<string, unknown>): string | undefined {
	if (!Array.isArray(event.messages)) return undefined;
	for (const message of [...event.messages].reverse()) {
		if (typeof message !== "object" || message === null) continue;
		const record = message as Record<string, unknown>;
		if (record.role === "assistant" || record.type === "message.output" || record.type === "assistant") {
			const text = contentText(record.content) ?? contentText(record.text);
			if (text) return text;
		}
	}
	return undefined;
}

export class FullSubagentPool {
	private readonly runtimes = new Map<string, RuntimeRecord>();
	private readonly pendingTasks = new Map<string, PendingTask>();
	private readonly taskTimeoutMs: number;

	constructor(configs: FullSubagentRuntimeConfig[], options: FullSubagentPoolOptions = {}) {
		this.taskTimeoutMs = options.taskTimeoutMs ?? DEFAULT_FULL_SUBAGENT_TASK_TIMEOUT_MS;
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
		const requestId = randomUUID();
		this.startTaskWithRequestId(agentId, requestId, task, cwd);
		return requestId;
	}

	runTask(agentId: string, task: string, cwd: string): Promise<FullSubagentTaskResult> {
		const requestId = randomUUID();
		const result = new Promise<FullSubagentTaskResult>((resolve, reject) => {
			const timeout = setTimeout(() => this.timeoutTask(agentId, requestId), this.taskTimeoutMs);
			this.pendingTasks.set(requestId, { resolve, reject, timeout });
		});
		try {
			this.startTaskWithRequestId(agentId, requestId, task, cwd);
		} catch (error) {
			this.rejectPendingTask(requestId, error instanceof Error ? error.message : String(error));
		}
		return result;
	}

	async runTeam(members: string[], task: string, cwd: string, execution: "parallel" | "serial"): Promise<FullSubagentTeamResult> {
		const results: Array<FullSubagentTaskResult & { agent: string }> = [];
		if (execution === "serial") {
			for (const agent of members) {
				results.push({ agent, ...(await this.runTask(agent, task, cwd)) });
			}
		} else {
			results.push(...await Promise.all(members.map(async (agent) => ({ agent, ...(await this.runTask(agent, task, cwd)) }))));
		}
		return {
			requestId: results.map((result) => result.requestId).join(","),
			text: results.map((result) => `${result.agent}: ${result.text}`).join("\n"),
			results,
		};
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

	private startTaskWithRequestId(agentId: string, requestId: string, task: string, cwd: string): void {
		const runtime = this.requireRuntime(agentId);
		runtime.snapshot.state = "busy";
		runtime.snapshot.activity = task;
		runtime.snapshot.requestId = requestId;
		runtime.config.transport.send(serializeProtocolLine(createProtocolMessage(agentId, "task.start", { requestId, task, cwd })));
	}

	private requireRuntime(agentId: string): RuntimeRecord {
		const runtime = this.runtimes.get(agentId);
		if (!runtime) throw new Error(`Unknown full subagent: ${agentId}`);
		return runtime;
	}

	private markDead(agentId: string): void {
		const runtime = this.runtimes.get(agentId);
		if (!runtime) return;
		this.rejectCurrentTask(runtime, "process exited");
		runtime.snapshot.state = "dead";
		runtime.snapshot.activity = "process exited";
		runtime.snapshot.requestId = undefined;
	}

	private rejectCurrentTask(runtime: RuntimeRecord, message: string): void {
		const requestId = runtime.snapshot.requestId;
		if (!requestId) return;
		this.rejectPendingTask(requestId, message);
	}

	private rejectPendingTask(requestId: string, message: string): void {
		const pending = this.pendingTasks.get(requestId);
		if (!pending) return;
		clearTimeout(pending.timeout);
		pending.reject(new Error(message));
		this.pendingTasks.delete(requestId);
	}

	private resolvePendingTask(requestId: string, result: FullSubagentTaskResult): void {
		const pending = this.pendingTasks.get(requestId);
		if (!pending) return;
		clearTimeout(pending.timeout);
		pending.resolve(result);
		this.pendingTasks.delete(requestId);
	}

	private timeoutTask(agentId: string, requestId: string): void {
		const runtime = this.runtimes.get(agentId);
		const message = `task timed out after ${this.taskTimeoutMs}ms`;
		if (runtime && runtime.snapshot.requestId === requestId) {
			runtime.snapshot.state = "error";
			runtime.snapshot.activity = "error";
			runtime.snapshot.requestId = undefined;
			runtime.snapshot.lastError = message;
		}
		this.rejectPendingTask(requestId, message);
	}

	private handleLine(agentId: string, line: string): void {
		const runtime = this.requireRuntime(agentId);
		let message: FullSubagentProtocolMessage;
		try {
			message = parseProtocolLine(line);
			if (message.agentId !== agentId) throw new Error(`Mismatched agent id: ${message.agentId}`);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			this.rejectCurrentTask(runtime, errorMessage);
			runtime.snapshot.state = "error";
			runtime.snapshot.activity = "protocol error";
			runtime.snapshot.requestId = undefined;
			runtime.snapshot.lastError = errorMessage;
			return;
		}
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
			const text = textValue(message.text) ?? "done";
			runtime.snapshot.state = "idle";
			runtime.snapshot.activity = "idle";
			runtime.snapshot.requestId = undefined;
			runtime.snapshot.lastResult = text;
			const requestId = textValue(message.requestId);
			if (requestId) this.resolvePendingTask(requestId, { requestId, text });
		}
		if (message.type === "task.error") {
			const error = textValue(message.error) ?? "task failed";
			const requestId = textValue(message.requestId) ?? runtime.snapshot.requestId;
			runtime.snapshot.state = "error";
			runtime.snapshot.activity = "error";
			runtime.snapshot.requestId = undefined;
			runtime.snapshot.lastError = error;
			if (requestId) this.rejectPendingTask(requestId, error);
		}
	}
}
