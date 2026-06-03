import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import modeExtension, { MODE_STATE_ENTRY, getNextMode, isWriteAllowedInMode, restoreModeState, type OrgmModeName } from "../extensions/mode.ts";

assert.equal(getNextMode("plan"), "build");
assert.equal(getNextMode("build"), "ask");
assert.equal(getNextMode("ask"), "sdd");
assert.equal(getNextMode("sdd"), "tdd");
assert.equal(getNextMode("tdd"), "plan");
assert.equal(restoreModeState([], "plan"), "plan");
assert.equal(restoreModeState([{ type: "custom", customType: MODE_STATE_ENTRY, data: { mode: "build" } }], "plan"), "build");
assert.equal(restoreModeState([{ type: "custom", customType: MODE_STATE_ENTRY, data: { mode: "bad" } }], "plan"), "plan");

assert.equal(isWriteAllowedInMode("build", "src/app.ts"), true);
assert.equal(isWriteAllowedInMode("plan", "docs/superpowers/plans/x.md"), true);
assert.equal(isWriteAllowedInMode("plan", "agents/plan.md"), true);
assert.equal(isWriteAllowedInMode("plan", "src/app.ts"), false);
assert.equal(isWriteAllowedInMode("ask", "docs/notes.md"), false);

const tempHome = mkdtempSync(join(tmpdir(), "mode-extension-home-"));
const configPath = join(tempHome, ".pi", "agent", "orgm.json");
mkdirSync(join(tempHome, ".pi", "agent"), { recursive: true });
writeFileSync(configPath, JSON.stringify({ mode: { defaultMode: "plan", allowedModes: ["plan", "build", "ask", "sdd", "tdd"] } }), { encoding: "utf8", flag: "w" });

const commands = new Map<string, any>();
const shortcuts = new Map<string, any>();
const handlers = new Map<string, any[]>();
const appended: Array<{ customType: string; data: unknown }> = [];
let activeTools: string[] = [];
let status = "";
let statusColor = "";
let notification = "";
const pi = {
	registerCommand(name: string, command: any) { commands.set(name, command); },
	registerShortcut(key: string, shortcut: any) { shortcuts.set(key, shortcut); },
	on(name: string, handler: any) { handlers.set(name, [...(handlers.get(name) ?? []), handler]); },
	appendEntry(customType: string, data: unknown) { appended.push({ customType, data }); },
	setActiveTools(names: string[]) { activeTools = names; },
	getAllTools() { return [{ name: "read" }, { name: "write" }, { name: "edit" }, { name: "bash" }, { name: "deploy_agent" }]; },
};

modeExtension(pi as any, { configPath });
const ctx = {
	cwd: process.cwd(),
	hasUI: true,
	sessionManager: { getEntries: () => [] },
	ui: {
		theme: { fg: (name: string, text: string) => { statusColor = name; return text; } },
		setStatus: (_key: string, value: string) => { status = value; },
		notify: (message: string) => { notification = message; },
	},
};

for (const handler of handlers.get("session_start") ?? []) await handler({ reason: "new" }, ctx);
assert.equal(status, "PLAN");
assert(activeTools.includes("read"));
assert(!activeTools.includes("write"));

await commands.get("mode").handler("build", ctx);
assert.equal(appended.at(-1)?.customType, MODE_STATE_ENTRY);
assert.deepEqual(appended.at(-1)?.data, { mode: "build" satisfies OrgmModeName });
assert.equal(status, "BUILD");
assert(activeTools.includes("write"));
assert.match(notification, /Mode: build/);

await shortcuts.get("alt+1").handler(ctx);
assert.equal(status, "ASK");

const beforeHandlers = handlers.get("before_agent_start") ?? [];
const result = await beforeHandlers[0]({ systemPrompt: "base" }, ctx);
assert.match(result.systemPrompt, /## ORGM Mode: ask/);
assert.match(result.systemPrompt, /Ask Mode/);

const toolHandlers = handlers.get("tool_call") ?? [];
const blocked = await toolHandlers[0]({ toolName: "write", input: { path: "src/app.ts" } }, ctx);
assert.equal(blocked.block, true);

await shortcuts.get("alt+1").handler(ctx);
assert.equal(status, "SDD");
assert.equal(statusColor, "error");

await shortcuts.get("alt+1").handler(ctx);
assert.equal(status, "TDD");
assert.equal(statusColor, "purple");
