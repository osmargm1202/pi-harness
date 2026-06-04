import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import modeExtension, { MODE_STATE_ENTRY, getNextMode, isWriteAllowedInMode, restoreModeState, type OrgmModeName } from "../extensions/mode.ts";

const originalSubagentRuntimeId = process.env.PI_SUBAGENT_RUNTIME_ID;
const originalSubagentDeploymentId = process.env.PI_SUBAGENT_DEPLOYMENT_ID;
delete process.env.PI_SUBAGENT_RUNTIME_ID;
delete process.env.PI_SUBAGENT_DEPLOYMENT_ID;

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
const supportedThemeColors = new Set(["warning", "accent", "error", "success", "cyan", "purple", "text", "borderAccent"]);
const pi = {
	registerCommand(name: string, command: any) { commands.set(name, command); },
	registerShortcut(key: string, shortcut: any) { shortcuts.set(key, shortcut); },
	on(name: string, handler: any) { handlers.set(name, [...(handlers.get(name) ?? []), handler]); },
	appendEntry(customType: string, data: unknown) { appended.push({ customType, data }); },
	setActiveTools(names: string[]) { activeTools = names; },
	getAllTools() { return [
		{ name: "read" },
		{ name: "write" },
		{ name: "edit" },
		{ name: "bash" },
		{ name: "deploy_agent" },
		{ name: "ask_user_question" },
		{ name: "engram_mem_search" },
		{ name: "engram_mem_context" },
		{ name: "engram_mem_get_observation" },
		{ name: "engram_mem_save" },
		{ name: "engram_mem_save_prompt" },
		{ name: "engram_mem_update" },
		{ name: "engram_mem_session_summary" },
		{ name: "engram_mem_capture_passive" },
		{ name: "exa_search" },
		{ name: "chrome-devtools_capture" },
		{ name: "obsidian_note" },
	]; },
};

modeExtension(pi as any, { configPath });
const ctx = {
	cwd: process.cwd(),
	hasUI: true,
	sessionManager: { getEntries: () => [] },
	ui: {
		theme: { fg: (name: string, text: string) => {
			if (!supportedThemeColors.has(name)) throw new Error(`Unknown theme color: ${name}`);
			statusColor = name;
			return text;
		} },
		setStatus: (_key: string, value: string) => { status = value; },
		notify: (message: string, kind?: string) => {
			if (kind && !supportedThemeColors.has(kind)) throw new Error(`Unknown theme color: ${kind}`);
			notification = message;
		},
	},
};

for (const handler of handlers.get("session_start") ?? []) await handler({ reason: "new" }, ctx);
assert.equal(status, "PLAN");
assert(activeTools.includes("read"));
assert(activeTools.includes("deploy_agent"), "PLAN should keep deploy_agent active for orchestration");
assert(activeTools.includes("ask_user_question"), "PLAN should keep ask_user_question active for clarifications");
assert(activeTools.includes("engram_mem_search"), "PLAN should keep Engram memory search active");
assert(activeTools.includes("exa_search"), "PLAN should expose available exa tools");
assert(activeTools.includes("chrome-devtools_capture"), "PLAN should expose available chrome-devtools tools");
assert(activeTools.includes("obsidian_note"), "PLAN should expose available obsidian tools");
const toolHandlers = handlers.get("tool_call") ?? [];
assert.equal((await toolHandlers[0]({ toolName: "bash", input: { command: "git status --short" } }))?.block, undefined, "PLAN should allow safe git review");
assert.equal((await toolHandlers[0]({ toolName: "bash", input: { command: "git add src/app.ts" } }))?.block, undefined, "PLAN should allow git add for commit workflow");
assert.equal((await toolHandlers[0]({ toolName: "bash", input: { command: "git commit -m 'wip'" } }))?.block, undefined, "PLAN should allow git commit for commit workflow");
const blocked = await toolHandlers[0]({ toolName: "write", input: { path: "src/app.ts" } }, ctx);
assert.equal(blocked.block, true);

await commands.get("mode").handler("build", ctx);
assert.equal(appended.at(-1)?.customType, MODE_STATE_ENTRY);
assert.deepEqual(appended.at(-1)?.data, { mode: "build" satisfies OrgmModeName });
assert.equal(status, "BUILD");
assert(activeTools.includes("write"));
assert.match(notification, /Mode: build/);

await shortcuts.get("alt+1").handler(ctx);
assert.equal(status, "ASK");
assert.equal(statusColor, "cyan");

const beforeHandlers = handlers.get("before_agent_start") ?? [];
const result = await beforeHandlers[0]({ systemPrompt: "base" }, ctx);
assert.match(result.systemPrompt, /## ORGM Mode: ask/);
assert.match(result.systemPrompt, /Ask Mode/);

await shortcuts.get("alt+1").handler(ctx);
assert.equal(status, "SDD");
assert.equal(statusColor, "error");
assert(activeTools.includes("deploy_agent"), "SDD should keep deploy_agent active for orchestration");
assert(activeTools.includes("ask_user_question"), "SDD should keep ask.ts active for clarification");
assert(activeTools.includes("engram_mem_save"), "SDD should keep Engram active");
assert(activeTools.includes("exa_search"), "SDD should expose available exa tools");
assert(activeTools.includes("chrome-devtools_capture"), "SDD should expose available chrome-devtools tools");
assert(activeTools.includes("obsidian_note"), "SDD should expose available obsidian tools");
assert(!activeTools.includes("write"), "SDD should not expose inline write");
assert(!activeTools.includes("edit"), "SDD should not expose inline edit");
assert.equal((await toolHandlers[0]({ toolName: "write", input: { path: "src/app.ts" } })).block, true, "SDD should block inline writes");
assert.equal((await toolHandlers[0]({ toolName: "bash", input: { command: "git status --short" } }))?.block, undefined, "SDD should allow safe git review");
assert.equal((await toolHandlers[0]({ toolName: "bash", input: { command: "git add src/app.ts" } }))?.block, undefined, "SDD should allow git add for commit workflow");
assert.equal((await toolHandlers[0]({ toolName: "bash", input: { command: "git commit -m 'wip'" } }))?.block, undefined, "SDD should allow git commit for commit workflow");
assert.equal((await toolHandlers[0]({ toolName: "bash", input: { command: "git push origin main" } })).block, true, "SDD should keep mutating remote commands blocked");

await shortcuts.get("alt+1").handler(ctx);
assert.equal(status, "TDD");
assert.equal(statusColor, "purple");
assert(activeTools.includes("deploy_agent"), "TDD should keep deploy_agent active for orchestration");
assert(activeTools.includes("ask_user_question"), "TDD should keep ask.ts active for clarification");
assert(activeTools.includes("engram_mem_save"), "TDD should keep Engram active");
assert(activeTools.includes("exa_search"), "TDD should expose available exa tools");
assert(activeTools.includes("chrome-devtools_capture"), "TDD should expose available chrome-devtools tools");
assert(activeTools.includes("obsidian_note"), "TDD should expose available obsidian tools");
assert(!activeTools.includes("write"), "TDD should not expose inline write");
assert(!activeTools.includes("edit"), "TDD should not expose inline edit");
assert.equal((await toolHandlers[0]({ toolName: "bash", input: { command: "git add src/app.ts" } }))?.block, undefined, "TDD should allow git add for commit workflow");
assert.equal((await toolHandlers[0]({ toolName: "bash", input: { command: "git commit -m 'wip'" } }))?.block, undefined, "TDD should allow git commit for commit workflow");
assert.equal((await toolHandlers[0]({ toolName: "edit", input: { path: "src/app.ts" } })).block, true, "TDD should block inline edits");

supportedThemeColors.delete("purple");
await shortcuts.get("alt+1").handler(ctx);
await shortcuts.get("alt+1").handler(ctx);
await shortcuts.get("alt+1").handler(ctx);
await shortcuts.get("alt+1").handler(ctx);
await shortcuts.get("alt+1").handler(ctx);
assert.equal(status, "TDD");
assert.equal(statusColor, "accent", "TDD should fall back when purple is unavailable");

try {
	process.env.PI_SUBAGENT_RUNTIME_ID = "child-runtime";
	const subagentHandlers = new Map<string, any[]>();
	let subagentActiveTools: string[] | undefined;
	const subagentPi = {
		registerCommand() { throw new Error("subagent runtime should not register mode command"); },
		registerShortcut() { throw new Error("subagent runtime should not register mode shortcut"); },
		on(name: string, handler: any) { subagentHandlers.set(name, [...(subagentHandlers.get(name) ?? []), handler]); },
		appendEntry() { throw new Error("subagent runtime should not append mode state"); },
		setActiveTools(names: string[]) { subagentActiveTools = names; },
		getAllTools() { return [{ name: "write" }, { name: "bash" }, { name: "deploy_agent" }]; },
	};
	modeExtension(subagentPi as any, { configPath });
	assert.equal(subagentHandlers.size, 0, "subagent runtime should not install mode handlers");
	assert.equal(subagentActiveTools, undefined, "subagent runtime should keep deploy_agent --tools allowlist untouched");
} finally {
	if (originalSubagentRuntimeId === undefined) delete process.env.PI_SUBAGENT_RUNTIME_ID;
	else process.env.PI_SUBAGENT_RUNTIME_ID = originalSubagentRuntimeId;
	if (originalSubagentDeploymentId === undefined) delete process.env.PI_SUBAGENT_DEPLOYMENT_ID;
	else process.env.PI_SUBAGENT_DEPLOYMENT_ID = originalSubagentDeploymentId;
}
