import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import notifyExtension from "../extensions/notify.ts";

type Handler = (event: any, ctx: any) => unknown | Promise<unknown>;

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

async function flushNotifications(): Promise<string> {
	await new Promise((resolve) => setTimeout(resolve, 100));
	return readFileSync(logPath, "utf8");
}

async function main(): Promise<void> {
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

	for (const handler of handlers.get("agent_end") ?? []) {
		await handler(
			{ messages: [{ role: "assistant", content: [{ type: "text", text: "finished" }] }] },
			{ cwd: "/tmp/project" },
		);
	}

	const log = await flushNotifications();
	const notificationLines = log.trim().split("\n").filter((line) => line.startsWith("notify-send -a Pi"));
	assert.equal(notificationLines.length, 3, "only questions, permissions, and final loop completion should notify");
	assert.match(log, /notify-send/, "notifications should call notify-send through distrobox-host-exec");
	assert.match(log, /-u critical/, "notifications should be critical so swaync shows a popup");
	assert.match(log, /Pi\\ question/, "ask_user_question should send a question notification");
	assert.match(log, /Pi\\ permission/, "permission prompts should send a permission notification");
	assert.match(log, /Pi\\ done/, "agent_end should send one final loop completion notification");
	assert.doesNotMatch(log, /bash/, "ordinary tool calls should not notify");
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
