import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import notifyExtension from "../extensions/notify.ts";

type Handler = (event: any, ctx: any) => unknown | Promise<unknown>;

type SubagentEnv = {
	PI_PDD_SUBAGENT?: string;
	PI_SUBAGENT_RUNTIME_ID?: string;
	PI_SUBAGENT_RUNTIME_DEPTH?: string;
};

const tempDir = mkdtempSync(join(tmpdir(), "pi-notify-test-"));
const logPath = join(tempDir, "notify.log");
const fakeDistroboxHostExec = join(tempDir, "distrobox-host-exec");

writeFileSync(
	fakeDistroboxHostExec,
	`#!/usr/bin/env bash
printf '%q ' "$@" >> ${JSON.stringify(logPath)}
printf '\n' >> ${JSON.stringify(logPath)}
exit 0
`,
);
chmodSync(fakeDistroboxHostExec, 0o755);
writeFileSync(logPath, "");

process.env.PATH = `${tempDir}:${process.env.PATH ?? ""}`;
process.env.container = "podman";
process.env.KITTY_PID = "12345";

const handlers = new Map<string, Handler[]>();
notifyExtension({
	on(event: string, handler: Handler) {
		handlers.set(event, [...(handlers.get(event) ?? []), handler]);
	},
} as any);

function resetLog(): void {
	writeFileSync(logPath, "");
}

async function flushNotifications(): Promise<string> {
	await new Promise((resolve) => setTimeout(resolve, 100));
	return readFileSync(logPath, "utf8");
}

async function emitToolCalls(): Promise<void> {
	for (const handler of handlers.get("tool_call") ?? []) {
		await handler(
			{ toolName: "ask_user_question", input: { questions: [{ question: "Continue?", header: "Next" }] } },
			{ cwd: "/tmp/project" },
		);
		await handler(
			{ toolName: "ask_user_permission", input: { question: "Allow edit?" } },
			{ cwd: "/tmp/project" },
		);
		await handler(
			{ toolName: "bash", input: { command: "echo noisy" } },
			{ cwd: "/tmp/project" },
		);
	}
}

async function emitAgentEnd(): Promise<void> {
	for (const handler of handlers.get("agent_end") ?? []) {
		await handler(
			{ messages: [{ role: "assistant", content: [{ type: "text", text: "finished" }] }] },
			{ cwd: "/tmp/project" },
		);
	}
}

function setSubagentEnv(env: SubagentEnv): void {
	for (const key of [
		"PI_PDD_SUBAGENT",
		"PI_SUBAGENT_RUNTIME_ID",
		"PI_SUBAGENT_RUNTIME_DEPTH",
	] as const) {
		const value = env[key];
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
}

async function main(): Promise<void> {
	resetLog();
	setSubagentEnv({});
	await emitToolCalls();
	await emitAgentEnd();

	const mainLog = await flushNotifications();
	const mainNotificationLines = mainLog
		.trim()
		.split("\n")
		.filter((line) => line.startsWith("notify-send -a Pi"));
	assert.equal(mainNotificationLines.length, 3, "questions, permissions, and main agent completion should notify");
	assert.match(mainLog, /notify-send/, "notifications should call notify-send through distrobox-host-exec");
	assert.match(mainLog, /-u critical/, "notifications should be critical so swaync shows a popup");
	assert.match(mainLog, /-e/, "notifications should be transient instead of persistent history entries");
	assert.match(mainLog, /-t [1-9]\d*/, "notifications should set a non-zero timeout so they auto-dismiss");
	assert.doesNotMatch(mainLog, /-t 0(\s|$)/, "notifications should not be sticky forever");
	assert.match(mainLog, /Pi\\ question/, "ask_user_question should send a question notification");
	assert.match(mainLog, /Pi\\ permission/, "permission prompts should send a permission notification");
	assert.match(mainLog, /Pi\\ done/, "agent_end should send a final loop completion notification for main agent");
	assert.doesNotMatch(mainLog, /finished/, "agent_end assistant text should not notify");
	assert.doesNotMatch(mainLog, /bash/, "ordinary tool calls should not notify");

	for (const env of [
		{ PI_PDD_SUBAGENT: "1" },
		{ PI_SUBAGENT_RUNTIME_ID: "runtime-123" },
		{ PI_SUBAGENT_RUNTIME_DEPTH: "1" },
	]) {
		resetLog();
		setSubagentEnv(env);
		await emitAgentEnd();
		const subagentLog = await flushNotifications();
		const subagentNotificationLines = subagentLog
			.trim()
			.split("\n")
			.filter((line) => line.startsWith("notify-send -a Pi"));
		assert.equal(subagentNotificationLines.length, 0, `subagent agent_end should stay quiet for ${JSON.stringify(env)}`);
		assert.doesNotMatch(subagentLog, /Pi\\ done/, "subagent completion should not send done notification");
		assert.doesNotMatch(subagentLog, /finished/, "subagent agent_end should not leak assistant text");
	}

	setSubagentEnv({});
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
