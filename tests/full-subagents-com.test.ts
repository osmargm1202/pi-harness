import assert from "node:assert/strict";
import {
	FullSubagentPool,
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
