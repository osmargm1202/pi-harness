import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import {
	FullSubagentPool,
	buildPiChildArgs,
	buildPiChildEnv,
	createPiRpcSubagentTransport,
	createProtocolMessage,
	parseProtocolLine,
	type FullSubagentTransport,
} from "../extensions/lib/full-subagents-com.ts";

class FakeTransport implements FullSubagentTransport {
	readonly sent: string[] = [];
	private messageHandler: ((line: string) => void) | undefined;
	private exitHandler: ((code: number | null) => void) | undefined;

	onMessage(handler: (line: string) => void): void {
		this.messageHandler = handler;
	}

	onExit(handler: (code: number | null) => void): void {
		this.exitHandler = handler;
	}

	send(line: string): void {
		this.sent.push(line);
	}

	kill(): void {
		this.exitHandler?.(null);
	}

	emit(message: object): void {
		this.messageHandler?.(`${JSON.stringify(message)}\n`);
	}

	emitRaw(line: string): void {
		this.messageHandler?.(line);
	}
}

class FakeChildProcess extends EventEmitter {
	readonly stdout = new PassThrough();
	readonly stderr = new PassThrough();
	readonly stdin = new PassThrough();
	killed = false;

	kill(): boolean {
		this.killed = true;
		this.emit("exit", null);
		return true;
	}
}

async function assertRejectsWithin(promise: Promise<unknown>, pattern: RegExp): Promise<void> {
	await assert.rejects(
		Promise.race([
			promise,
			new Promise((_resolve, reject) => setTimeout(() => reject(new Error("timed out waiting for rejection")), 25)),
		]),
		pattern,
	);
}

const encoded = createProtocolMessage("agent-a", "ready", { state: "idle" });
const parsed = parseProtocolLine(JSON.stringify(encoded));
assert.equal(parsed.type, "ready");
assert.equal(parsed.agentId, "agent-a");
assert.equal(parsed.protocolVersion, 1);

assert.throws(() => parseProtocolLine("not json"), /Invalid protocol JSON/);
assert.throws(() => parseProtocolLine(JSON.stringify({ type: "ready" })), /Invalid protocol message/);

const fake = new FakeTransport();
const pool = new FullSubagentPool([
	{ agentId: "tdd-planner", agentName: "tdd-planner", model: "test/model", transport: fake },
]);

assert.equal(pool.getSnapshot()[0].state, "starting");
fake.emit(createProtocolMessage("tdd-planner", "ready", { state: "idle", compactCount: 0 }));
assert.equal(pool.getSnapshot()[0].state, "idle");

const requestId = pool.startTask("tdd-planner", "write a plan", "/repo");
assert.equal(pool.getSnapshot()[0].state, "busy");
assert.equal(fake.sent[0].endsWith("\n"), true);
assert.equal(JSON.parse(fake.sent[0]).type, "task.start");
assert.equal(JSON.parse(fake.sent[0]).requestId, requestId);

fake.emit(createProtocolMessage("tdd-planner", "status", {
	requestId,
	state: "busy",
	activity: "reading files",
	contextTokens: 1000,
	contextWindow: 10000,
	compactCount: 1,
}));
assert.equal(pool.getSnapshot()[0].activity, "reading files");
assert.equal(pool.getSnapshot()[0].contextPercent, 10);
assert.equal(pool.getSnapshot()[0].compactCount, 1);

fake.emit(createProtocolMessage("tdd-planner", "task.done", {
	requestId,
	text: "done",
}));
assert.equal(pool.getSnapshot()[0].state, "idle");
assert.equal(pool.getSnapshot()[0].lastResult, "done");

pool.cancelTask("tdd-planner", "manual");
const cancelLine = fake.sent.at(-1)!;
assert.equal(cancelLine.endsWith("\n"), true);
assert.equal(JSON.parse(cancelLine).type, "task.cancel");

pool.shutdown();
const shutdownLine = fake.sent.at(-1)!;
assert.equal(shutdownLine.endsWith("\n"), true);
assert.equal(JSON.parse(shutdownLine).type, "shutdown");
assert.equal(pool.getSnapshot()[0].state, "dead");

const malformed = new FakeTransport();
const malformedPool = new FullSubagentPool([
	{ agentId: "tdd-reviewer", agentName: "tdd-reviewer", model: "test/model", transport: malformed },
]);
assert.doesNotThrow(() => malformed.emitRaw("not json\n"));
assert.equal(malformedPool.getSnapshot()[0].state, "error");
assert.match(malformedPool.getSnapshot()[0].lastError ?? "", /Invalid protocol JSON/);

const exitRejects = new FakeTransport();
const exitRejectsPool = new FullSubagentPool([
	{ agentId: "tdd-exit", agentName: "tdd-exit", model: "test/model", transport: exitRejects },
]);
const exitPromise = exitRejectsPool.runTask("tdd-exit", "will exit", "/repo");
exitRejects.kill();
await assertRejectsWithin(exitPromise, /process exited/);
assert.equal(exitRejectsPool.getSnapshot()[0].requestId, undefined);

const protocolErrorRejects = new FakeTransport();
const protocolErrorRejectsPool = new FullSubagentPool([
	{ agentId: "tdd-protocol", agentName: "tdd-protocol", model: "test/model", transport: protocolErrorRejects },
]);
const protocolErrorPromise = protocolErrorRejectsPool.runTask("tdd-protocol", "will hit protocol error", "/repo");
protocolErrorRejects.emitRaw("not json\n");
await assertRejectsWithin(protocolErrorPromise, /Invalid protocol JSON/);
assert.equal(protocolErrorRejectsPool.getSnapshot()[0].requestId, undefined);

const requestlessError = new FakeTransport();
const requestlessErrorPool = new FullSubagentPool([
	{ agentId: "tdd-requestless", agentName: "tdd-requestless", model: "test/model", transport: requestlessError },
]);
const requestlessErrorPromise = requestlessErrorPool.runTask("tdd-requestless", "will fail without id", "/repo");
requestlessError.emit(createProtocolMessage("tdd-requestless", "task.error", { error: "child failed before id" }));
await assertRejectsWithin(requestlessErrorPromise, /child failed before id/);
assert.equal(requestlessErrorPool.getSnapshot()[0].requestId, undefined);

const hungTask = new FakeTransport();
const hungTaskPool = new FullSubagentPool([
	{ agentId: "tdd-hung", agentName: "tdd-hung", model: "test/model", transport: hungTask },
], { taskTimeoutMs: 5 });
const hungTaskPromise = hungTaskPool.runTask("tdd-hung", "will never finish", "/repo");
await assertRejectsWithin(hungTaskPromise, /timed out/);
assert.equal(hungTaskPool.getSnapshot()[0].state, "error");
assert.match(hungTaskPool.getSnapshot()[0].lastError ?? "", /timed out/);
assert.equal(hungTaskPool.getSnapshot()[0].requestId, undefined);

const completedBeforeTimeout = new FakeTransport();
const completedBeforeTimeoutPool = new FullSubagentPool([
	{ agentId: "tdd-fast", agentName: "tdd-fast", model: "test/model", transport: completedBeforeTimeout },
], { taskTimeoutMs: 5 });
const completedBeforeTimeoutPromise = completedBeforeTimeoutPool.runTask("tdd-fast", "finishes quickly", "/repo");
const completedBeforeTimeoutRequestId = JSON.parse(completedBeforeTimeout.sent[0]).requestId;
completedBeforeTimeout.emit(createProtocolMessage("tdd-fast", "task.done", {
	requestId: completedBeforeTimeoutRequestId,
	text: "fast done",
}));
assert.deepEqual(await completedBeforeTimeoutPromise, { requestId: completedBeforeTimeoutRequestId, text: "fast done" });
await new Promise((resolve) => setTimeout(resolve, 10));
assert.equal(completedBeforeTimeoutPool.getSnapshot()[0].state, "idle");
assert.equal(completedBeforeTimeoutPool.getSnapshot()[0].lastError, undefined);

assert.deepEqual(
	buildPiChildArgs({
		agentName: "tdd-planner",
		model: "anthropic/claude-sonnet-4-5",
		tools: ["read", "bash"],
		cwd: "/repo",
	}),
	[
		"--mode",
		"rpc",
		"--no-session",
		"--model",
		"anthropic/claude-sonnet-4-5",
		"--tools",
		"read,bash",
	],
);

const childEnv = buildPiChildEnv({ existingEnv: { PATH: "/bin", PI_FULL_SUBAGENT_CHILD: "0" } });
assert.equal(childEnv.PATH, "/bin");
assert.equal(childEnv.PI_FULL_SUBAGENT_CHILD, "1");
assert.equal(childEnv.PI_SUBAGENT_CHILD, "1");
assert.equal(childEnv.PI_SUBAGENT_DEPTH, "1");

const nestedChildEnv = buildPiChildEnv({ existingEnv: { PI_SUBAGENT_DEPTH: "2" } });
assert.equal(nestedChildEnv.PI_SUBAGENT_DEPTH, "3");

const child = new FakeChildProcess();
const rpcTransport = createPiRpcSubagentTransport({ agentName: "tdd-planner", tools: [], cwd: "/repo" }, child);
const protocolLines: string[] = [];
rpcTransport.onMessage((line) => protocolLines.push(line));
rpcTransport.send(JSON.stringify(createProtocolMessage("tdd-planner", "task.start", {
	requestId: "req-1",
	task: "write tests",
	cwd: "/repo",
})));
const rpcPrompt = JSON.parse(child.stdin.read().toString());
assert.equal(rpcPrompt.id, "req-1");
assert.equal(rpcPrompt.type, "prompt");
assert.match(rpcPrompt.message, /Full subagent task/);
assert.match(rpcPrompt.message, /Working directory:\s+\/repo/);
assert.match(rpcPrompt.message, /Task:\s+write tests/);
child.stdout.write(`${JSON.stringify({ id: "req-1", type: "response", command: "prompt", success: true })}\n`);
child.stdout.write(`${JSON.stringify({ type: "agent_start" })}\n`);
child.stdout.write(`${JSON.stringify({
	type: "agent_end",
	messages: [{ role: "assistant", content: "child done" }],
})}\n`);
assert.deepEqual(protocolLines.map((line) => JSON.parse(line).type), ["ready", "status", "status", "task.done"]);
assert.equal(JSON.parse(protocolLines.at(-1)!).requestId, "req-1");
assert.equal(JSON.parse(protocolLines.at(-1)!).text, "child done");

const failedChild = new FakeChildProcess();
const failedTransport = createPiRpcSubagentTransport({ agentName: "tdd-verifier", tools: [], cwd: "/repo" }, failedChild);
const failedLines: string[] = [];
failedTransport.onMessage((line) => failedLines.push(line));
failedTransport.send(JSON.stringify(createProtocolMessage("tdd-verifier", "task.start", {
	requestId: "req-2",
	task: "verify release",
	cwd: "/workspace/other-repo",
})));
const failedRpcPrompt = JSON.parse(failedChild.stdin.read().toString());
assert.equal(failedRpcPrompt.id, "req-2");
assert.match(failedRpcPrompt.message, /Working directory:\s+\/workspace\/other-repo/);
assert.match(failedRpcPrompt.message, /Task:\s+verify release/);
failedChild.stdout.write(`${JSON.stringify({
	id: "req-2",
	type: "response",
	command: "prompt",
	success: false,
	error: "provider failed",
})}\n`);
assert.equal(JSON.parse(failedLines.at(-1)!).type, "task.error");
assert.equal(JSON.parse(failedLines.at(-1)!).requestId, "req-2");
assert.equal(JSON.parse(failedLines.at(-1)!).error, "provider failed");
