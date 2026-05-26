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

for (const handler of handlers.get("agent_end") ?? []) {
	await handler(
		{ messages: [{ role: "assistant", content: [{ type: "text", text: "finished" }] }] },
		{ cwd: "/tmp/project" },
	);
}

await new Promise((resolve) => setTimeout(resolve, 100));

const log = readFileSync(logPath, "utf8");
assert.match(log, /notify-send/, "agent_end should call notify-send through distrobox-host-exec");
assert.match(log, /-u critical/, "done notifications should be critical so swaync shows a popup like question notifications");
assert.match(log, /Pi\\ done/, "agent_end should send a Pi done notification");
