# Report Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `extensions/report.ts`, a configurable ORGM Pi extension that periodically asks the active agent to estimate progress and emit a compact inline report with a percentage bar.

**Architecture:** Add a `report` slice to central ORGM config, a small `report-config.ts` wrapper, and a focused extension that tracks agent-loop activity and sends a steering user message on a timer. The active agent owns the estimate; the extension only prompts for the report and supplies recent runtime facts.

**Tech Stack:** TypeScript Pi extensions, Node test runner style via direct `tsx` tests, `@earendil-works/pi-coding-agent` extension API.

---

## File Structure

- Modify `extensions/lib/orgm-config.ts` — add `OrgmReportConfig`, defaults, merge logic, and writable slice support.
- Create `extensions/lib/report-config.ts` — wrapper functions for the new `report` slice.
- Create `extensions/report.ts` — timer lifecycle, activity tracking, report prompt builder, and optional command to toggle settings.
- Modify `tests/orgm-config.test.ts` — assert report config defaults/custom slice/save behavior.
- Create `tests/report-extension.test.ts` — extension harness tests for timer, prompt content, and cleanup.

---

### Task 1: Add report config slice

**Files:**
- Modify: `extensions/lib/orgm-config.ts`
- Modify: `tests/orgm-config.test.ts`

- [ ] **Step 1: Write failing config assertions**

Add to the initial JSON in `tests/orgm-config.test.ts`:

```ts
report: { enabled: false, intervalMinutes: 3 },
```

Add assertions after the existing `agentStatus` assertions:

```ts
assert.equal(loadOrgmConfigSlice("report", configPath).enabled, false, "report.enabled should load from central orgm.json");
assert.equal(loadOrgmConfigSlice("report", configPath).intervalMinutes, 3, "report.intervalMinutes should load from central orgm.json");
```

Add save assertions after the existing `saveOrgmConfigSlice("title", ...)` call:

```ts
saveOrgmConfigSlice("report", { enabled: true, intervalMinutes: 12 }, configPath);
const savedReportConfig = loadOrgmConfig(configPath);
assert.equal(savedReportConfig.report.enabled, true, "report.enabled should persist through saveOrgmConfigSlice");
assert.equal(savedReportConfig.report.intervalMinutes, 12, "report.intervalMinutes should persist through saveOrgmConfigSlice");
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npx tsx tests/orgm-config.test.ts
```

Expected: TypeScript/runtime failure because `report` is not a known config slice.

- [ ] **Step 3: Implement report config in `orgm-config.ts`**

Add interface:

```ts
export interface OrgmReportConfig {
	enabled: boolean;
	intervalMinutes: number;
}
```

Add `report: OrgmReportConfig;` to `OrgmHostConfig`.

Add default:

```ts
report: {
	enabled: true,
	intervalMinutes: 10,
},
```

Add merge function:

```ts
export function mergeReportConfig(value: unknown): OrgmReportConfig {
	const raw = isRecord(value) ? value : {};
	const intervalMinutes = typeof raw.intervalMinutes === "number" && Number.isFinite(raw.intervalMinutes) && raw.intervalMinutes >= 1
		? raw.intervalMinutes
		: DEFAULT_ORGM_CONFIG.report.intervalMinutes;
	return {
		enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_ORGM_CONFIG.report.enabled,
		intervalMinutes,
	};
}
```

Add to `mergeOrgmConfig` return:

```ts
report: mergeReportConfig(raw.report),
```

Add `"report"` to `WritableOrgmConfigSliceKey` pick.

- [ ] **Step 4: Run test to verify pass**

Run:

```bash
npx tsx tests/orgm-config.test.ts
```

Expected: exits 0.

---

### Task 2: Add report config wrapper

**Files:**
- Create: `extensions/lib/report-config.ts`
- Create/modify: covered by `tests/orgm-config.test.ts`

- [ ] **Step 1: Add wrapper assertions**

Import in `tests/orgm-config.test.ts`:

```ts
import { loadReportConfig, saveReportConfig } from "../extensions/lib/report-config.ts";
```

Add assertions:

```ts
assert.equal(loadReportConfig(configPath).enabled, false, "report wrapper should load enabled through central slice helper");
assert.equal(loadReportConfig(configPath).intervalMinutes, 3, "report wrapper should load interval through central slice helper");
saveReportConfig({ enabled: true, intervalMinutes: 15 }, configPath);
assert.equal(loadReportConfig(configPath).intervalMinutes, 15, "report wrapper should save interval through central slice helper");
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npx tsx tests/orgm-config.test.ts
```

Expected: import failure for missing `report-config.ts`.

- [ ] **Step 3: Create wrapper**

Create `extensions/lib/report-config.ts`:

```ts
import { loadOrgmConfigSlice, orgmConfigPath, saveOrgmConfigSlice } from "./orgm-config.ts";

export interface ReportConfig {
	enabled: boolean;
	intervalMinutes: number;
}

export const REPORT_CONFIG_DEFAULTS: ReportConfig = {
	enabled: true,
	intervalMinutes: 10,
};

export function getReportConfigPath(): string {
	return orgmConfigPath();
}

export function loadReportConfig(configPath?: string): ReportConfig {
	return { ...loadOrgmConfigSlice("report", configPath) };
}

export function saveReportConfig(config: ReportConfig, configPath?: string): void {
	saveOrgmConfigSlice("report", config, configPath);
}
```

- [ ] **Step 4: Run test to verify pass**

Run:

```bash
npx tsx tests/orgm-config.test.ts
```

Expected: exits 0.

---

### Task 3: Implement report prompt builder and timer extension

**Files:**
- Create: `extensions/report.ts`
- Create: `tests/report-extension.test.ts`

- [ ] **Step 1: Write failing extension tests**

Create a harness in `tests/report-extension.test.ts` that captures handlers and `sendUserMessage` calls:

```ts
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import reportExtension, { buildProgressBar, buildReportPrompt } from "../extensions/report.ts";

function createHarness() {
	const handlers = new Map<string, Function[]>();
	const sentUserMessages: Array<{ content: string; options: unknown }> = [];
	const pi = {
		on(event: string, handler: Function) {
			handlers.set(event, [...(handlers.get(event) ?? []), handler]);
		},
		sendUserMessage(content: string, options?: unknown) {
			sentUserMessages.push({ content, options });
		},
	};
	const ctx = {
		cwd: "/tmp/project",
		hasUI: true,
		sessionManager: { getSessionFile: () => "/tmp/session.jsonl" },
	};
	return { pi, handlers, sentUserMessages, ctx };
}

assert.equal(buildProgressBar(40), "[####------]40%");
assert.equal(buildProgressBar(0), "[----------]0%");
assert.equal(buildProgressBar(100), "[##########]100%");

const prompt = buildReportPrompt({
	startedAt: 0,
	turnCount: 2,
	lastActivity: "edit",
	recentErrors: ["bash: failed"],
});
assert.match(prompt, /porcentaje/i);
assert.match(prompt, /\[####------\]40%/);
assert.match(prompt, /continúa/i);

const tempDir = mkdtempSync(join(tmpdir(), "report-extension-"));
try {
	const configPath = join(tempDir, "orgm.json");
	writeFileSync(configPath, JSON.stringify({ report: { enabled: true, intervalMinutes: 1 } }), "utf8");
	const harness = createHarness();
	reportExtension(harness.pi as never, { configPath, intervalMs: 10 });
	await harness.handlers.get("agent_start")![0]!({}, harness.ctx);
	await new Promise((resolve) => setTimeout(resolve, 25));
	assert(harness.sentUserMessages.length >= 1, "enabled report extension should send periodic steering prompt");
	assert.deepEqual(harness.sentUserMessages[0]!.options, { deliverAs: "steer" });
	assert.match(harness.sentUserMessages[0]!.content, /\[####------\]40%/);
	await harness.handlers.get("agent_end")![0]!({}, harness.ctx);
	const countAfterEnd = harness.sentUserMessages.length;
	await new Promise((resolve) => setTimeout(resolve, 25));
	assert.equal(harness.sentUserMessages.length, countAfterEnd, "agent_end should clear the timer");
} finally {
	rmSync(tempDir, { recursive: true, force: true });
}

{
	const tempDir = mkdtempSync(join(tmpdir(), "report-extension-disabled-"));
	try {
		const configPath = join(tempDir, "orgm.json");
		writeFileSync(configPath, JSON.stringify({ report: { enabled: false, intervalMinutes: 1 } }), "utf8");
		const harness = createHarness();
		reportExtension(harness.pi as never, { configPath, intervalMs: 10 });
		await harness.handlers.get("agent_start")![0]!({}, harness.ctx);
		await new Promise((resolve) => setTimeout(resolve, 25));
		assert.equal(harness.sentUserMessages.length, 0, "disabled report extension should not send prompts");
	} finally {
		rmSync(tempDir, { recursive: true, force: true });
	}
}
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
npx tsx tests/report-extension.test.ts
```

Expected: import failure for missing `extensions/report.ts`.

- [ ] **Step 3: Implement extension**

Create `extensions/report.ts` with exported helpers and default extension factory:

```ts
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { loadReportConfig } from "./lib/report-config.ts";

export interface ReportExtensionOptions {
	configPath?: string;
	intervalMs?: number;
}

export interface ReportRuntimeState {
	startedAt: number;
	turnCount: number;
	lastActivity?: string;
	recentErrors: string[];
}

const MAX_ERRORS = 3;

function cleanLine(value: string): string {
	return value.replace(/\s+/g, " ").trim();
}

export function buildProgressBar(percent: number): string {
	const clamped = Math.max(0, Math.min(100, Math.round(percent)));
	const filled = Math.max(0, Math.min(10, Math.round(clamped / 10)));
	return `[${"#".repeat(filled)}${"-".repeat(10 - filled)}]${clamped}%`;
}

export function buildReportPrompt(state: ReportRuntimeState, now = Date.now()): string {
	const elapsedMinutes = Math.max(0, Math.round((now - state.startedAt) / 60_000));
	const errors = state.recentErrors.length > 0 ? state.recentErrors.map((error) => `- ${error}`).join("\n") : "ninguno detectado por la extensión";
	return `Emite SOLO un informe inline corto del avance actual y luego continúa con la tarea original.

Necesito que ESTIMES el porcentaje real de implementación del compromiso actual según tu propio estado de trabajo. No uses el porcentaje de la extensión si no coincide con tu criterio.

Formato obligatorio:
📊 Informe de avance · <porcentaje>%
[####------]40%
Estado: <qué estás haciendo ahora>
No hemos terminado porque: <razón concreta>
Falta: <lista corta>
Errores: <errores o bloqueadores; si no hay, "ninguno">

Reglas:
- La barra tiene 10 espacios y debe coincidir con tu porcentaje estimado: por ejemplo ${buildProgressBar(40)}.
- Sé breve: máximo 6 líneas útiles.
- No cierres la tarea, no des resumen final, solo informe de progreso.
- Después del informe, continúa el trabajo original.

Datos recientes de ejecución:
- Tiempo activo aproximado: ${elapsedMinutes} min
- Turnos observados: ${state.turnCount}
- Última actividad: ${state.lastActivity ?? "no determinada"}
- Errores observados por la extensión:\n${errors}`;
}

function getIntervalMs(options: ReportExtensionOptions): number {
	if (typeof options.intervalMs === "number" && Number.isFinite(options.intervalMs) && options.intervalMs > 0) return options.intervalMs;
	const config = loadReportConfig(options.configPath);
	return config.intervalMinutes * 60_000;
}

function toolErrorSummary(event: { toolName?: string; isError?: boolean; result?: unknown }): string | undefined {
	if (!event.isError) return undefined;
	const toolName = event.toolName ?? "tool";
	const result = typeof event.result === "object" && event.result !== null ? JSON.stringify(event.result).slice(0, 180) : String(event.result ?? "error");
	return cleanLine(`${toolName}: ${result}`);
}

export default function reportExtension(pi: ExtensionAPI, options: ReportExtensionOptions = {}) {
	let timer: ReturnType<typeof setInterval> | undefined;
	let activeCtx: ExtensionContext | undefined;
	let state: ReportRuntimeState = { startedAt: Date.now(), turnCount: 0, recentErrors: [] };

	const stopTimer = () => {
		if (timer) clearInterval(timer);
		timer = undefined;
		activeCtx = undefined;
	};

	const sendReportPrompt = () => {
		if (!activeCtx) return;
		pi.sendUserMessage(buildReportPrompt(state), { deliverAs: "steer" });
	};

	pi.on("agent_start", async (_event, ctx) => {
		stopTimer();
		const config = loadReportConfig(options.configPath);
		if (!config.enabled) return;
		activeCtx = ctx;
		state = { startedAt: Date.now(), turnCount: 0, recentErrors: [] };
		timer = setInterval(sendReportPrompt, getIntervalMs(options));
	});

	pi.on("turn_start", async (_event, _ctx) => {
		state = { ...state, turnCount: state.turnCount + 1, lastActivity: `turn ${state.turnCount + 1} iniciado` };
	});

	pi.on("tool_execution_end", async (event: { toolName?: string; isError?: boolean; result?: unknown }, _ctx) => {
		const error = toolErrorSummary(event);
		state = {
			...state,
			lastActivity: event.toolName ? `tool ${event.toolName}` : state.lastActivity,
			recentErrors: error ? [...state.recentErrors, error].slice(-MAX_ERRORS) : state.recentErrors,
		};
	});

	pi.on("turn_end", async (_event, _ctx) => {
		state = { ...state, lastActivity: `turn ${state.turnCount} terminado` };
	});

	pi.on("agent_end", async () => stopTimer());
	pi.on("session_shutdown", async () => stopTimer());
}
```

- [ ] **Step 4: Run report extension test**

Run:

```bash
npx tsx tests/report-extension.test.ts
```

Expected: exits 0.

---

### Task 4: Verify integrated test set

**Files:**
- Test all modified/created tests.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npx tsx tests/orgm-config.test.ts && npx tsx tests/report-extension.test.ts
```

Expected: both exit 0.

- [ ] **Step 2: Check git diff**

Run:

```bash
git diff -- extensions/lib/orgm-config.ts extensions/lib/report-config.ts extensions/report.ts tests/orgm-config.test.ts tests/report-extension.test.ts
```

Expected: diff only contains the report extension implementation and tests.

- [ ] **Step 3: Commit implementation**

Run:

```bash
git add extensions/lib/orgm-config.ts extensions/lib/report-config.ts extensions/report.ts tests/orgm-config.test.ts tests/report-extension.test.ts docs/superpowers/plans/2026-05-27-report-extension.md
git commit -m "feat: add periodic report extension"
```
