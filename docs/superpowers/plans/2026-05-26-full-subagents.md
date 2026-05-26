# full-subagents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a configurable persistent pool of headless Pi subagents, expose strict-delegation tools to the parent agent, and render live subagent status in the parent TUI.

**Architecture:** Split the feature into four focused modules: config parsing, protocol/runtime communication, widget rendering, and extension glue. Start with testable pure modules and fake transports, then wire the real child-process transport after behavior is covered.

**Tech Stack:** TypeScript Pi extensions, `@earendil-works/pi-coding-agent` extension APIs, `@earendil-works/pi-tui` rendering helpers, Node `assert`, Node subprocess APIs.

---

## File structure

- Create `extensions/lib/full-subagents-config.ts` — config types, defaults, merge, validation, and `loadFullSubagentsConfig()`.
- Create `extensions/lib/full-subagents-com.ts` — protocol types, state machine, fakeable transport interface, pool manager, and child process transport.
- Create `extensions/lib/full-subagents-widget.ts` — pure render helpers plus Pi `ctx.ui.setWidget()` integration helper.
- Create `extensions/full-subagents.ts` — Pi extension entrypoint, tools, commands, strict delegation prompt injection, pool lifecycle.
- Modify `extensions/lib/orgm-config.ts` — add `fullSubagents` to `OrgmHostConfig`, defaults, merge, and allowed `saveOrgmConfigSlice()` keys.
- Create `tests/full-subagents-config.test.ts`.
- Create `tests/full-subagents-com.test.ts`.
- Create `tests/full-subagents-widget.test.ts`.
- Create `tests/full-subagents-extension.test.ts`.

Use `node --test tests/<file>.test.ts` for each new test file. If a test command fails because a pre-existing extensionless import in another module is loaded, keep the failure evidence and either adjust the new module to avoid importing that path or run the single new test with a direct import path that includes `.ts` extensions.

---

### Task 1: Config module and ORGM integration

**Files:**
- Create: `extensions/lib/full-subagents-config.ts`
- Modify: `extensions/lib/orgm-config.ts`
- Test: `tests/full-subagents-config.test.ts`

- [ ] **Step 1: Write the failing config tests**

Create `tests/full-subagents-config.test.ts` with:

```ts
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	DEFAULT_FULL_SUBAGENTS_CONFIG,
	loadFullSubagentsConfig,
	mergeFullSubagentsConfig,
} from "../extensions/lib/full-subagents-config.ts";
import { loadOrgmConfig } from "../extensions/lib/orgm-config.ts";

assert.equal(DEFAULT_FULL_SUBAGENTS_CONFIG.enabled, false);
assert.equal(DEFAULT_FULL_SUBAGENTS_CONFIG.strictDelegation, true);
assert.equal(DEFAULT_FULL_SUBAGENTS_CONFIG.maxAgents, 5);
assert.equal(DEFAULT_FULL_SUBAGENTS_CONFIG.startupTeam, "tdd-core");
assert.deepEqual(DEFAULT_FULL_SUBAGENTS_CONFIG.teams["tdd-core"], [
	"tdd-brainstormer",
	"tdd-planner",
	"tdd-implementer",
	"tdd-reviewer",
	"tdd-verifier",
]);

const merged = mergeFullSubagentsConfig({
	enabled: true,
	strictDelegation: false,
	maxAgents: 99,
	startupTeam: "custom",
	teams: { custom: ["alpha", "", "beta", "alpha"] },
	agents: {
		alpha: {
			model: "anthropic/claude-sonnet-4-5",
			tools: ["read", "bash"],
			skills: "all",
			mcp: "inherit",
			extensions: "none",
		},
	},
});
assert.equal(merged.enabled, true);
assert.equal(merged.strictDelegation, false);
assert.equal(merged.maxAgents, 10);
assert.equal(merged.startupTeam, "custom");
assert.deepEqual(merged.teams.custom, ["alpha", "beta"]);
assert.deepEqual(merged.agents.alpha.tools, ["read", "bash"]);
assert.equal(merged.agents.alpha.skills, "all");
assert.equal(merged.agents.alpha.mcp, "inherit");
assert.equal(merged.agents.alpha.extensions, "none");

const tempDir = mkdtempSync(join(tmpdir(), "full-subagents-config-"));
const configPath = join(tempDir, "orgm.json");
try {
	writeFileSync(
		configPath,
		JSON.stringify(
			{
				fullSubagents: {
					enabled: true,
					maxAgents: 0,
					startupTeam: "solo",
					teams: { solo: ["tdd-verifier"] },
				},
			},
			null,
			2,
		),
		"utf8",
	);
	const fromLoader = loadFullSubagentsConfig(configPath);
	assert.equal(fromLoader.enabled, true);
	assert.equal(fromLoader.maxAgents, 1);
	assert.deepEqual(fromLoader.teams.solo, ["tdd-verifier"]);

	const orgm = loadOrgmConfig(configPath);
	assert.equal(orgm.fullSubagents.enabled, true);
	assert.equal(orgm.fullSubagents.maxAgents, 1);
	assert.equal(orgm.fullSubagents.startupTeam, "solo");
} finally {
	rmSync(tempDir, { recursive: true, force: true });
}
```

- [ ] **Step 2: Run the failing config test**

Run:

```bash
node --test tests/full-subagents-config.test.ts
```

Expected: failure because `extensions/lib/full-subagents-config.ts` does not exist and `OrgmHostConfig` has no `fullSubagents` property.

- [ ] **Step 3: Implement `full-subagents-config.ts`**

Create `extensions/lib/full-subagents-config.ts` with:

```ts
import { existsSync, readFileSync } from "node:fs";

export type FullSubagentListMode = "inherit" | "all" | "none" | string[];

export interface FullSubagentAgentConfig {
	model?: string;
	tools: FullSubagentListMode;
	skills: FullSubagentListMode;
	mcp: FullSubagentListMode;
	extensions: FullSubagentListMode;
}

export interface FullSubagentsConfig {
	enabled: boolean;
	strictDelegation: boolean;
	startupTeam: string;
	maxAgents: number;
	teams: Record<string, string[]>;
	agents: Record<string, FullSubagentAgentConfig>;
}

export const DEFAULT_TDD_CORE_TEAM = [
	"tdd-brainstormer",
	"tdd-planner",
	"tdd-implementer",
	"tdd-reviewer",
	"tdd-verifier",
] as const;

export const DEFAULT_FULL_SUBAGENTS_CONFIG: FullSubagentsConfig = {
	enabled: false,
	strictDelegation: true,
	startupTeam: "tdd-core",
	maxAgents: 5,
	teams: { "tdd-core": [...DEFAULT_TDD_CORE_TEAM] },
	agents: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanName(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function clampMaxAgents(value: unknown): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_FULL_SUBAGENTS_CONFIG.maxAgents;
	return Math.max(1, Math.min(10, Math.trunc(value)));
}

function cleanStringList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return Array.from(
		new Set(value.map(cleanName).filter((item): item is string => Boolean(item))),
	);
}

function mergeListMode(value: unknown, fallback: FullSubagentListMode): FullSubagentListMode {
	if (value === "inherit" || value === "all" || value === "none") return value;
	if (Array.isArray(value)) return cleanStringList(value);
	return fallback;
}

function mergeAgentConfig(value: unknown): FullSubagentAgentConfig {
	const raw = isRecord(value) ? value : {};
	return {
		...(cleanName(raw.model) ? { model: cleanName(raw.model) } : {}),
		tools: mergeListMode(raw.tools, "inherit"),
		skills: mergeListMode(raw.skills, "inherit"),
		mcp: mergeListMode(raw.mcp, "inherit"),
		extensions: mergeListMode(raw.extensions, "inherit"),
	};
}

function mergeTeams(value: unknown): Record<string, string[]> {
	const merged: Record<string, string[]> = structuredClone(DEFAULT_FULL_SUBAGENTS_CONFIG.teams);
	if (!isRecord(value)) return merged;
	for (const [teamName, members] of Object.entries(value)) {
		const cleanTeamName = cleanName(teamName);
		const cleanMembers = cleanStringList(members);
		if (cleanTeamName && cleanMembers.length > 0) merged[cleanTeamName] = cleanMembers;
	}
	return merged;
}

function mergeAgents(value: unknown): Record<string, FullSubagentAgentConfig> {
	const agents: Record<string, FullSubagentAgentConfig> = {};
	if (!isRecord(value)) return agents;
	for (const [name, config] of Object.entries(value)) {
		const cleanAgentName = cleanName(name);
		if (cleanAgentName) agents[cleanAgentName] = mergeAgentConfig(config);
	}
	return agents;
}

export function mergeFullSubagentsConfig(value: unknown): FullSubagentsConfig {
	const raw = isRecord(value) ? value : {};
	return {
		enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_FULL_SUBAGENTS_CONFIG.enabled,
		strictDelegation: typeof raw.strictDelegation === "boolean"
			? raw.strictDelegation
			: DEFAULT_FULL_SUBAGENTS_CONFIG.strictDelegation,
		startupTeam: cleanName(raw.startupTeam) ?? DEFAULT_FULL_SUBAGENTS_CONFIG.startupTeam,
		maxAgents: clampMaxAgents(raw.maxAgents),
		teams: mergeTeams(raw.teams),
		agents: mergeAgents(raw.agents),
	};
}

export function loadFullSubagentsConfig(configPath: string): FullSubagentsConfig {
	if (!existsSync(configPath)) return structuredClone(DEFAULT_FULL_SUBAGENTS_CONFIG);
	try {
		const parsed = JSON.parse(readFileSync(configPath, "utf8"));
		return mergeFullSubagentsConfig(isRecord(parsed) ? parsed.fullSubagents : undefined);
	} catch {
		return structuredClone(DEFAULT_FULL_SUBAGENTS_CONFIG);
	}
}
```

- [ ] **Step 4: Wire `orgm-config.ts` to the new config**

Modify `extensions/lib/orgm-config.ts`:

1. Add the import near the top:

```ts
import {
	DEFAULT_FULL_SUBAGENTS_CONFIG,
	type FullSubagentsConfig,
	mergeFullSubagentsConfig,
} from "./full-subagents-config.ts";
```

2. Add the property to `OrgmHostConfig`:

```ts
	fullSubagents: FullSubagentsConfig;
```

3. Add the default inside `DEFAULT_ORGM_CONFIG`:

```ts
	fullSubagents: structuredClone(DEFAULT_FULL_SUBAGENTS_CONFIG),
```

4. Add the merge field inside `mergeOrgmConfig()`:

```ts
		fullSubagents: mergeFullSubagentsConfig(raw.fullSubagents),
```

5. Extend the `saveOrgmConfigSlice` type union so it includes `"fullSubagents"`:

```ts
export function saveOrgmConfigSlice<K extends keyof Pick<OrgmHostConfig, "defaultPrimaryAgent" | "caveman" | "minimalSkills" | "agentStatus" | "repoTree" | "title" | "fullSubagents">>(
```

- [ ] **Step 5: Run the config test until it passes**

Run:

```bash
node --test tests/full-subagents-config.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit config work**

Run:

```bash
git add extensions/lib/full-subagents-config.ts extensions/lib/orgm-config.ts tests/full-subagents-config.test.ts
git commit -m "feat: add full subagents config"
```

---

### Task 2: Protocol types, fake transport, and pool state machine

**Files:**
- Create: `extensions/lib/full-subagents-com.ts`
- Test: `tests/full-subagents-com.test.ts`

- [ ] **Step 1: Write the failing protocol/state tests**

Create `tests/full-subagents-com.test.ts` with:

```ts
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
assert.equal(JSON.parse(fake.sent.at(-1)!).type, "task.cancel");

fake.kill();
assert.equal(pool.getSnapshot()[0].state, "dead");
```

- [ ] **Step 2: Run the failing protocol test**

Run:

```bash
node --test tests/full-subagents-com.test.ts
```

Expected: failure because `full-subagents-com.ts` does not exist.

- [ ] **Step 3: Implement protocol and pool**

Create `extensions/lib/full-subagents-com.ts` with:

```ts
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
		runtime.config.transport.send(JSON.stringify(createProtocolMessage(agentId, "task.start", { requestId, task, cwd })));
		return requestId;
	}

	cancelTask(agentId: string, reason: string): void {
		const runtime = this.requireRuntime(agentId);
		runtime.config.transport.send(JSON.stringify(createProtocolMessage(agentId, "task.cancel", {
			requestId: runtime.snapshot.requestId,
			reason,
		})));
	}

	shutdown(): void {
		for (const runtime of this.runtimes.values()) {
			runtime.config.transport.send(JSON.stringify(createProtocolMessage(runtime.config.agentId, "shutdown")));
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
```

- [ ] **Step 4: Run the protocol test until it passes**

Run:

```bash
node --test tests/full-subagents-com.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit protocol work**

Run:

```bash
git add extensions/lib/full-subagents-com.ts tests/full-subagents-com.test.ts
git commit -m "feat: add full subagents protocol pool"
```

---

### Task 3: Widget rendering module

**Files:**
- Create: `extensions/lib/full-subagents-widget.ts`
- Test: `tests/full-subagents-widget.test.ts`

- [ ] **Step 1: Write the failing widget tests**

Create `tests/full-subagents-widget.test.ts` with:

```ts
import assert from "node:assert/strict";
import { renderFullSubagentsWidgetLines } from "../extensions/lib/full-subagents-widget.ts";
import type { FullSubagentSnapshot } from "../extensions/lib/full-subagents-com.ts";

const base: FullSubagentSnapshot = {
	agentId: "tdd-planner",
	agentName: "tdd-planner",
	model: "anthropic/claude-sonnet-4-5",
	state: "idle",
	activity: "idle",
	contextTokens: 1000,
	contextWindow: 10000,
	contextPercent: 10,
	compactCount: 1,
};

const lines = renderFullSubagentsWidgetLines([
	base,
	{ ...base, agentId: "tdd-implementer", agentName: "tdd-implementer", state: "busy", activity: "editing failing tests", contextPercent: 55 },
	{ ...base, agentId: "tdd-verifier", agentName: "tdd-verifier", state: "dead", activity: "process exited", lastError: "exit 1" },
], 80, {
	color: false,
	showModel: true,
	showContext: true,
	showCompact: true,
});

assert(lines[0].includes("Full subagents"));
assert(lines.some((line) => line.includes("tdd-planner")));
assert(lines.some((line) => line.includes("idle")));
assert(lines.some((line) => line.includes("tdd-implementer")));
assert(lines.some((line) => line.includes("busy")));
assert(lines.some((line) => line.includes("tdd-verifier")));
assert(lines.some((line) => line.includes("dead")));
assert(lines.some((line) => line.includes("ctx 55%")));
assert(lines.some((line) => line.includes("compact 1")));
assert(lines.every((line) => line.length <= 80));

const narrow = renderFullSubagentsWidgetLines([
	{ ...base, agentName: "agent-with-a-very-long-name-that-must-truncate", activity: "activity with many words that must also truncate" },
], 32, { color: false, showModel: true, showContext: true, showCompact: true });
assert(narrow.every((line) => line.length <= 32));
```

- [ ] **Step 2: Run the failing widget test**

Run:

```bash
node --test tests/full-subagents-widget.test.ts
```

Expected: failure because the widget module does not exist.

- [ ] **Step 3: Implement pure widget rendering**

Create `extensions/lib/full-subagents-widget.ts` with:

```ts
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { truncateToWidth } from "@earendil-works/pi-tui";
import type { FullSubagentSnapshot, FullSubagentState } from "./full-subagents-com.ts";

export interface FullSubagentsWidgetOptions {
	color: boolean;
	showModel: boolean;
	showContext: boolean;
	showCompact: boolean;
}

export const FULL_SUBAGENTS_WIDGET_KEY = "full-subagents";

function stateSymbol(state: FullSubagentState): string {
	if (state === "busy" || state === "compacting") return "◉";
	if (state === "idle") return "●";
	if (state === "dead") return "×";
	if (state === "error") return "!";
	return "○";
}

function plainLine(snapshot: FullSubagentSnapshot): string {
	const parts = [
		`${stateSymbol(snapshot.state)} ${snapshot.agentName}`,
		snapshot.state,
		snapshot.model,
		`ctx ${snapshot.contextPercent}%`,
		`compact ${snapshot.compactCount}`,
		snapshot.activity,
		snapshot.lastError ? `error ${snapshot.lastError}` : undefined,
	].filter((part): part is string => Boolean(part));
	return parts.join(" · ");
}

export function renderFullSubagentsWidgetLines(
	snapshots: FullSubagentSnapshot[],
	width: number,
	options: FullSubagentsWidgetOptions,
): string[] {
	if (snapshots.length === 0) return [];
	const busy = snapshots.filter((snapshot) => snapshot.state === "busy" || snapshot.state === "compacting").length;
	const dead = snapshots.filter((snapshot) => snapshot.state === "dead" || snapshot.state === "error").length;
	const header = `Full subagents · ${busy} busy · ${snapshots.length - busy - dead} idle · ${dead} down`;
	return [
		truncateToWidth(header, width),
		...snapshots.map((snapshot) => {
			const parts = [
				`${stateSymbol(snapshot.state)} ${snapshot.agentName}`,
				snapshot.state,
				options.showModel ? snapshot.model : undefined,
				options.showContext ? `ctx ${snapshot.contextPercent}%` : undefined,
				options.showCompact ? `compact ${snapshot.compactCount}` : undefined,
				snapshot.activity,
				snapshot.lastError ? `error ${snapshot.lastError}` : undefined,
			].filter((part): part is string => Boolean(part));
			return truncateToWidth(parts.join(" · "), width);
		}),
	];
}

function colorize(ctx: ExtensionContext, line: string): string {
	if (line.includes("dead") || line.includes("error")) return ctx.ui.theme.fg("error", line);
	if (line.includes("busy") || line.includes("compacting")) return ctx.ui.theme.fg("warning", line);
	if (line.includes("idle")) return ctx.ui.theme.fg("success", line);
	return ctx.ui.theme.fg("accent", line);
}

export function installFullSubagentsWidget(
	ctx: ExtensionContext,
	getSnapshots: () => FullSubagentSnapshot[],
	options: Omit<FullSubagentsWidgetOptions, "color">,
): void {
	if (!ctx.hasUI) return;
	ctx.ui.setWidget(FULL_SUBAGENTS_WIDGET_KEY, (_tui, _theme) => ({
		invalidate() {},
		render(width: number): string[] {
			const lines = renderFullSubagentsWidgetLines(getSnapshots(), width, { ...options, color: true });
			return lines.map((line, index) => index === 0 ? ctx.ui.theme.fg("accent", line) : colorize(ctx, line));
		},
	}));
}

export function clearFullSubagentsWidget(ctx: ExtensionContext): void {
	if (!ctx.hasUI) return;
	ctx.ui.setWidget(FULL_SUBAGENTS_WIDGET_KEY, undefined);
}
```

- [ ] **Step 4: Remove unused helper if lint complains**

If TypeScript or lint flags `plainLine` as unused, remove this exact function from `extensions/lib/full-subagents-widget.ts`:

```ts
function plainLine(snapshot: FullSubagentSnapshot): string {
	const parts = [
		`${stateSymbol(snapshot.state)} ${snapshot.agentName}`,
		snapshot.state,
		snapshot.model,
		`ctx ${snapshot.contextPercent}%`,
		`compact ${snapshot.compactCount}`,
		snapshot.activity,
		snapshot.lastError ? `error ${snapshot.lastError}` : undefined,
	].filter((part): part is string => Boolean(part));
	return parts.join(" · ");
}
```

- [ ] **Step 5: Run the widget test until it passes**

Run:

```bash
node --test tests/full-subagents-widget.test.ts
```

Expected: pass.

- [ ] **Step 6: Commit widget work**

Run:

```bash
git add extensions/lib/full-subagents-widget.ts tests/full-subagents-widget.test.ts
git commit -m "feat: render full subagents widget"
```

---

### Task 4: Extension glue with fake pool injection

**Files:**
- Create: `extensions/full-subagents.ts`
- Test: `tests/full-subagents-extension.test.ts`

- [ ] **Step 1: Write a small fake Pi API test**

Create `tests/full-subagents-extension.test.ts` with:

```ts
import assert from "node:assert/strict";
import registerFullSubagents, {
	FULL_SUBAGENT_TASK_TOOL,
	FULL_QUERY_TEAM_TOOL,
	STRICT_DELEGATION_SNIPPET,
} from "../extensions/full-subagents.ts";

const handlers = new Map<string, Function[]>();
const tools: any[] = [];
const commands = new Map<string, any>();
const activeTools: string[] = [];

const fakePi: any = {
	on(event: string, handler: Function) {
		handlers.set(event, [...(handlers.get(event) ?? []), handler]);
	},
	registerTool(tool: any) {
		tools.push(tool);
	},
	registerCommand(name: string, command: any) {
		commands.set(name, command);
	},
	getActiveTools() {
		return activeTools;
	},
	setActiveTools(names: string[]) {
		activeTools.splice(0, activeTools.length, ...names);
	},
	events: { emit() {}, on() {} },
};

registerFullSubagents(fakePi);

assert(tools.some((tool) => tool.name === FULL_SUBAGENT_TASK_TOOL));
assert(tools.some((tool) => tool.name === FULL_QUERY_TEAM_TOOL));
assert(commands.has("full-subagents"));

const beforeAgentStart = handlers.get("before_agent_start")?.[0];
assert(beforeAgentStart, "before_agent_start handler should be registered");

const result = await beforeAgentStart(
	{ systemPrompt: "base prompt" },
	{ cwd: process.cwd(), hasUI: false, ui: {}, sessionManager: { getSessionFile: () => undefined } },
);
assert(result.systemPrompt.includes("base prompt"));
assert(result.systemPrompt.includes(STRICT_DELEGATION_SNIPPET));

const taskTool = tools.find((tool) => tool.name === FULL_SUBAGENT_TASK_TOOL);
const taskResult = await taskTool.execute(
	"call-1",
	{ agent: "tdd-planner", task: "plan tests", cwd: process.cwd() },
	undefined,
	undefined,
	{ cwd: process.cwd(), hasUI: false, ui: {}, sessionManager: { getSessionFile: () => undefined } },
);
assert(taskResult.content[0].text.includes("queued"));
assert.equal(taskResult.details.agent, "tdd-planner");

const teamTool = tools.find((tool) => tool.name === FULL_QUERY_TEAM_TOOL);
const teamResult = await teamTool.execute(
	"call-2",
	{ team: "tdd-core", task: "review plan", execution: "parallel" },
	undefined,
	undefined,
	{ cwd: process.cwd(), hasUI: false, ui: {}, sessionManager: { getSessionFile: () => undefined } },
);
assert(teamResult.content[0].text.includes("tdd-core"));
assert.equal(teamResult.details.team, "tdd-core");
```

- [ ] **Step 2: Run the failing extension test**

Run:

```bash
node --test tests/full-subagents-extension.test.ts
```

Expected: failure because `extensions/full-subagents.ts` does not exist.

- [ ] **Step 3: Implement minimal extension glue**

Create `extensions/full-subagents.ts` with:

```ts
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import { DEFAULT_FULL_SUBAGENTS_CONFIG, loadFullSubagentsConfig, type FullSubagentsConfig } from "./lib/full-subagents-config.ts";
import { FullSubagentPool, type FullSubagentSnapshot } from "./lib/full-subagents-com.ts";
import { clearFullSubagentsWidget, installFullSubagentsWidget } from "./lib/full-subagents-widget.ts";
import { orgmConfigPath } from "./lib/orgm-config.ts";

export const FULL_SUBAGENT_TASK_TOOL = "full_subagent_task";
export const FULL_QUERY_TEAM_TOOL = "full_query_team";
export const STRICT_DELEGATION_SNIPPET = "You are the parent orchestrator for full-subagents. Delegate meaningful design, coding, review, debugging, and verification work to full_subagent_task or full_query_team. Answer directly only for clarification, coordination, brief summaries, or selecting the next delegation step.";

const TaskParams = Type.Object({
	agent: Type.String({ description: "Configured full subagent name" }),
	task: Type.String({ description: "Task to assign" }),
	cwd: Type.Optional(Type.String({ description: "Working directory for the subagent task" })),
});

const TeamParams = Type.Object({
	team: Type.String({ description: "Configured full subagent team" }),
	task: Type.String({ description: "Task to assign to the team" }),
	execution: Type.Optional(StringEnum(["parallel", "serial"] as const, { default: "parallel" })),
});

function fallbackSnapshots(config: FullSubagentsConfig): FullSubagentSnapshot[] {
	const members = config.teams[config.startupTeam] ?? [];
	return members.slice(0, config.maxAgents).map((agentName) => ({
		agentId: agentName,
		agentName,
		model: config.agents[agentName]?.model,
		state: "idle",
		activity: "configured",
		contextTokens: 0,
		contextWindow: 0,
		contextPercent: 0,
		compactCount: 0,
	}));
}

export default function registerFullSubagents(pi: ExtensionAPI) {
	let config = DEFAULT_FULL_SUBAGENTS_CONFIG;
	let snapshots: FullSubagentSnapshot[] = [];
	let pool: FullSubagentPool | undefined;

	const getSnapshots = () => pool?.getSnapshot() ?? snapshots;

	pi.on("session_start", async (_event: unknown, ctx: ExtensionContext) => {
		config = loadFullSubagentsConfig(orgmConfigPath());
		snapshots = fallbackSnapshots(config);
		if (config.enabled && ctx.hasUI) {
			installFullSubagentsWidget(ctx, getSnapshots, { showModel: true, showContext: true, showCompact: true });
		}
	});

	pi.on("before_agent_start", async (event: any) => {
		config = config ?? DEFAULT_FULL_SUBAGENTS_CONFIG;
		if (!config.strictDelegation) return;
		return { systemPrompt: `${event.systemPrompt}\n\n${STRICT_DELEGATION_SNIPPET}` };
	});

	pi.on("session_shutdown", async (_event: unknown, ctx: ExtensionContext) => {
		pool?.shutdown();
		clearFullSubagentsWidget(ctx);
	});

	pi.registerCommand("full-subagents", {
		description: "Show full subagents status: /full-subagents [restart <agent>|team <name>]",
		handler: async (args: string, ctx: ExtensionContext) => {
			const trimmed = args.trim();
			if (!ctx.hasUI) return;
			if (!trimmed) {
				ctx.ui.notify(`Full subagents: ${getSnapshots().length} configured`, "info");
				return;
			}
			ctx.ui.notify(`Full subagents command accepted: ${trimmed}`, "info");
		},
	});

	pi.registerTool({
		name: FULL_SUBAGENT_TASK_TOOL,
		label: "Full Subagent Task",
		description: "Assign a task to a persistent full Pi subagent from the configured pool.",
		promptSnippet: "Assign meaningful work to a persistent full Pi subagent.",
		promptGuidelines: ["Use full_subagent_task for meaningful work when strict full-subagents delegation is active."],
		parameters: TaskParams,
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const cwd = params.cwd ?? ctx.cwd;
			let requestId = "queued-without-runtime";
			if (pool) requestId = pool.startTask(params.agent, params.task, cwd);
			return {
				content: [{ type: "text", text: `Task queued for ${params.agent}: ${params.task}` }],
				details: { agent: params.agent, task: params.task, cwd, requestId },
			};
		},
	});

	pi.registerTool({
		name: FULL_QUERY_TEAM_TOOL,
		label: "Full Query Team",
		description: "Assign work to a configured persistent full-subagents team.",
		promptSnippet: "Query a persistent full-subagents team in parallel or serial.",
		promptGuidelines: ["Use full_query_team when multiple full subagents should contribute to a task."],
		parameters: TeamParams,
		async execute(_toolCallId, params) {
			const members = config.teams[params.team] ?? [];
			return {
				content: [{ type: "text", text: `Team ${params.team} queued for ${members.length} member(s): ${params.task}` }],
				details: { team: params.team, task: params.task, execution: params.execution ?? "parallel", members },
			};
		},
	});
}
```

- [ ] **Step 4: Run the extension test until it passes**

Run:

```bash
node --test tests/full-subagents-extension.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit extension glue**

Run:

```bash
git add extensions/full-subagents.ts tests/full-subagents-extension.test.ts
git commit -m "feat: add full subagents extension shell"
```

---

### Task 5: Real child process transport and startup pool wiring

**Files:**
- Modify: `extensions/lib/full-subagents-com.ts`
- Modify: `extensions/full-subagents.ts`
- Test: `tests/full-subagents-com.test.ts`
- Test: `tests/full-subagents-extension.test.ts`

- [ ] **Step 1: Extend protocol tests for child transport command building**

Append to `tests/full-subagents-com.test.ts`:

```ts
import { buildPiChildArgs } from "../extensions/lib/full-subagents-com.ts";

assert.deepEqual(
	buildPiChildArgs({
		agentName: "tdd-planner",
		model: "anthropic/claude-sonnet-4-5",
		tools: ["read", "bash"],
		cwd: "/repo",
	}),
	[
		"--mode",
		"json",
		"-p",
		"--no-session",
		"--model",
		"anthropic/claude-sonnet-4-5",
		"--tools",
		"read,bash",
		"Full subagent tdd-planner ready. Wait for task protocol messages from parent.",
	],
);
```

- [ ] **Step 2: Run the failing transport test**

Run:

```bash
node --test tests/full-subagents-com.test.ts
```

Expected: failure because `buildPiChildArgs` is not exported.

- [ ] **Step 3: Add child args builder and transport interface hooks**

Add to `extensions/lib/full-subagents-com.ts`:

```ts
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
```

- [ ] **Step 4: Wire enabled startup snapshots in the extension**

Modify the `session_start` handler in `extensions/full-subagents.ts` so it keeps the MVP safe while real long-running child transport is introduced:

```ts
	pi.on("session_start", async (_event: unknown, ctx: ExtensionContext) => {
		config = loadFullSubagentsConfig(orgmConfigPath());
		snapshots = fallbackSnapshots(config);
		if (!config.enabled) return;
		if (ctx.hasUI) {
			installFullSubagentsWidget(ctx, getSnapshots, { showModel: true, showContext: true, showCompact: true });
			ctx.ui.notify(`Full subagents startup team: ${config.startupTeam} (${snapshots.length})`, "info");
		}
	});
```

This keeps the first implementation stable and visible while the next task can replace fallback snapshots with real spawned transports.

- [ ] **Step 5: Run focused tests**

Run:

```bash
node --test tests/full-subagents-com.test.ts
node --test tests/full-subagents-extension.test.ts
```

Expected: both pass.

- [ ] **Step 6: Commit startup transport prep**

Run:

```bash
git add extensions/lib/full-subagents-com.ts extensions/full-subagents.ts tests/full-subagents-com.test.ts tests/full-subagents-extension.test.ts
git commit -m "feat: prepare full subagents child transport"
```

---

### Task 6: Package registration and README documentation

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Test: existing package metadata checks by inspection and `node --test` focused tests.

- [ ] **Step 1: Confirm package extension discovery includes the new file**

Read `package.json`. It already has:

```json
"pi": {
  "extensions": ["./extensions"],
  "skills": ["./skills"],
  "prompts": ["./prompts"],
  "themes": ["./themes"]
}
```

No package change is needed if `extensions/full-subagents.ts` should auto-discover with the whole `./extensions` directory.

- [ ] **Step 2: Add README usage docs**

Append this section to `README.md`:

```md
## full-subagents

`extensions/full-subagents.ts` starts a configurable team of persistent headless Pi subagents and gives the parent agent tools for strict delegation.

Minimal `~/.pi/agent/orgm.json` slice:

```json
{
  "fullSubagents": {
    "enabled": true,
    "strictDelegation": true,
    "startupTeam": "tdd-core",
    "maxAgents": 5
  }
}
```

When enabled, the parent TUI shows a `Full subagents` widget. Busy or compacting agents are highlighted, idle agents are muted/healthy, and dead or errored agents are marked as down.

Parent-facing tools:

- `full_subagent_task` — assign a task to one configured subagent.
- `full_query_team` — assign work to a configured team in parallel or serial.

Commands:

- `/full-subagents` — show configured pool status.
- `/full-subagents restart <agent>` — accepted command shape for restarting an agent.
- `/full-subagents team <name>` — accepted command shape for switching teams.
```

- [ ] **Step 3: Run focused tests**

Run:

```bash
node --test tests/full-subagents-config.test.ts
node --test tests/full-subagents-com.test.ts
node --test tests/full-subagents-widget.test.ts
node --test tests/full-subagents-extension.test.ts
```

Expected: all new tests pass.

- [ ] **Step 4: Commit docs**

Run:

```bash
git add README.md
git commit -m "docs: document full subagents"
```

---

## Final verification

- [ ] Run all new tests:

```bash
node --test tests/full-subagents-config.test.ts tests/full-subagents-com.test.ts tests/full-subagents-widget.test.ts tests/full-subagents-extension.test.ts
```

Expected: all new tests pass.

- [ ] Check repo status and confirm only intentional files changed:

```bash
git status --short
```

Expected: no uncommitted files from this feature branch. If unrelated user files are still modified, do not stage or commit them.

- [ ] Manual smoke check in Pi after installing/reloading the extension:

```bash
pi
/reload
/full-subagents
```

Expected: Pi starts, reload succeeds, `/full-subagents` reports configured pool status, and no startup crash occurs when `fullSubagents.enabled` is false.

## Spec coverage self-review

- Config in `orgm.json.fullSubagents`: Task 1.
- Persistent team surface and strict delegation tools: Task 4.
- Protocol/state/request lifecycle: Task 2 and Task 5.
- Widget live/idle/dead display: Task 3.
- Error/dead state handling foundation: Task 2.
- TDD coverage: Tasks 1-4 and final verification.
- External terminal windows and embedded multi-TUI are intentionally excluded from this MVP per spec.
