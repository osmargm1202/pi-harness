import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import reportExtension, {
	buildProgressBar,
	buildReportPrompt,
	type ReportRuntimeState,
} from "../extensions/report.ts";

type Handler = (event: any, ctx: any) => unknown | Promise<unknown>;

type TimerRecord = {
	id: number;
	callback: () => void | Promise<void>;
	intervalMs: number;
};

function createHarness() {
	const handlers = new Map<string, Handler[]>();
	const sentMessages: Array<{ prompt: string; options: unknown }> = [];
	const pi = {
		on(event: string, handler: Handler) {
			handlers.set(event, [...(handlers.get(event) ?? []), handler]);
		},
		sendUserMessage(prompt: string, options?: unknown) {
			sentMessages.push({ prompt, options });
			return Promise.resolve();
		},
	};
	return { pi, handlers, sentMessages };
}

async function emit(
	handlers: Map<string, Handler[]>,
	eventName: string,
	event: any,
	ctx: any,
): Promise<void> {
	for (const handler of handlers.get(eventName) ?? []) {
		await handler(event, ctx);
	}
}

const originalSetInterval = globalThis.setInterval;
const originalClearInterval = globalThis.clearInterval;
const originalDateNow = Date.now;
const timers = new Map<number, TimerRecord>();
const clearedTimerIds: number[] = [];
let nextTimerId = 1;
let fakeNow = 0;

(globalThis as any).setInterval = (callback: () => void | Promise<void>, intervalMs: number) => {
	const timer = { id: nextTimerId++, callback, intervalMs } satisfies TimerRecord;
	timers.set(timer.id, timer);
	return timer.id;
};

(globalThis as any).clearInterval = (timerId: number) => {
	clearedTimerIds.push(timerId);
	timers.delete(timerId);
};

Date.now = () => fakeNow;

async function main(): Promise<void> {
	assert.equal(buildProgressBar(40), "[####------]40%", "progress bar should render a 10-slot percentage bar");
	assert.equal(buildProgressBar(145), "[##########]100%", "progress bar should clamp values above 100");
	assert.equal(buildProgressBar(-5), "[----------]0%", "progress bar should clamp values below 0");

	const promptState: ReportRuntimeState = {
		startedAt: 120_000,
		turnCount: 3,
		lastActivity: "turn 3 ended",
		recentErrors: ["bash: exit 1"],
	};
	const prompt = buildReportPrompt(promptState, 245_000);
	assert.match(prompt, /estimate implementation percent/i);
	assert.match(prompt, /\[####------\]40%/i);
	assert.match(prompt, /elapsed: 2m 5s/i);
	assert.match(prompt, /turns: 3/i);
	assert.match(prompt, /last activity: turn 3 ended/i);
	assert.match(prompt, /recent errors: bash: exit 1/i);
	assert.match(prompt, /continue the original task afterward/i);

	const home = mkdtempSync(join(tmpdir(), "pi-report-extension-"));
	try {
		const configPath = join(home, ".pi", "agent", "orgm.json");
		mkdirSync(join(home, ".pi", "agent"), { recursive: true });
		writeFileSync(configPath, JSON.stringify({ report: { enabled: true, intervalMinutes: 2 } }), "utf8");

		const enabled = createHarness();
		reportExtension(enabled.pi as never, { configPath } as never);
		const ctx = { cwd: "/tmp/project", hasUI: true };

		fakeNow = 1_000;
		await emit(enabled.handlers, "agent_start", {}, ctx);

		assert.equal(timers.size, 1, "agent_start should arm one interval when report is enabled");
		const timer = [...timers.values()][0]!;
		assert.equal(timer.intervalMs, 120000, "interval should use report intervalMinutes from config");

		fakeNow = 11_000;
		await emit(enabled.handlers, "turn_start", {}, ctx);
		fakeNow = 15_000;
		await emit(enabled.handlers, "tool_execution_end", { toolName: "read", isError: false }, ctx);
		fakeNow = 20_000;
		await emit(enabled.handlers, "turn_end", {}, ctx);
		fakeNow = 25_000;
		await emit(enabled.handlers, "turn_start", {}, ctx);
		fakeNow = 30_000;
		await emit(enabled.handlers, "tool_execution_end", {
			toolName: "bash",
			isError: true,
			error: { message: "exit 1" },
		}, ctx);
		fakeNow = 41_000;
		await emit(enabled.handlers, "turn_end", {}, ctx);
		fakeNow = 126_000;
		await timer.callback();
		assert.equal(enabled.sentMessages.length, 1, "active timer should send one steering message");
		assert.deepEqual(enabled.sentMessages[0]!.options, { deliverAs: "steer" });
		assert.match(enabled.sentMessages[0]!.prompt, /elapsed: 2m 5s/i);
		assert.match(enabled.sentMessages[0]!.prompt, /turns: 2/i);
		assert.match(enabled.sentMessages[0]!.prompt, /last activity: turn 2 ended/i);
		assert.match(enabled.sentMessages[0]!.prompt, /recent errors: bash: exit 1/i);
		assert.match(enabled.sentMessages[0]!.prompt, /do not invent percent/i);

		await emit(enabled.handlers, "agent_end", {}, ctx);
		assert.deepEqual(clearedTimerIds, [timer.id], "agent_end should clear the active timer");
		assert.equal(timers.size, 0, "cleared timer should no longer remain active");

		writeFileSync(configPath, JSON.stringify({ report: { enabled: false, intervalMinutes: 2 } }), "utf8");
		const disabled = createHarness();
		reportExtension(disabled.pi as never, { configPath } as never);
		await emit(disabled.handlers, "agent_start", {}, ctx);
		assert.equal(timers.size, 0, "disabled config should not arm an interval");
		assert.equal(disabled.sentMessages.length, 0, "disabled config should not send reports");

		writeFileSync(configPath, JSON.stringify({ report: { enabled: true, intervalMinutes: 1 } }), "utf8");
		const shutdown = createHarness();
		reportExtension(shutdown.pi as never, { configPath } as never);
		await emit(shutdown.handlers, "agent_start", {}, ctx);
		const shutdownTimer = [...timers.values()][0]!;
		await emit(shutdown.handlers, "session_shutdown", {}, ctx);
		assert.deepEqual(clearedTimerIds, [timer.id, shutdownTimer.id], "session_shutdown should also clear the active timer");
		assert.equal(timers.size, 0, "session_shutdown should leave no active timers");
	} finally {
		rmSync(home, { recursive: true, force: true });
		(globalThis as any).setInterval = originalSetInterval;
		(globalThis as any).clearInterval = originalClearInterval;
		Date.now = originalDateNow;
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
