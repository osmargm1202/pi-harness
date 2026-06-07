# Limit Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `extensions/limit.ts` and minimal footer integration to display Codex and Spark 5-hour/weekly remaining usage bars in a new context row.

**Architecture:** Put pure parsing/formatting/auth helpers in `extensions/lib/limit-usage.ts`, keep the extension runtime in `extensions/limit.ts`, and keep terminal layout in `extensions/minimal.ts`/`extensions/lib/minimal-title.ts`. `limit.ts` fetches `/wham/usage`, emits `orgm:limits-changed`, and `minimal.ts` renders the latest full/compact limits row below the existing folder/mode/title row.

**Tech Stack:** TypeScript pi extensions, Node built-ins (`fs`, `os`, `path`), global `fetch`, Node test runner via `node --test`.

---

## File Structure

- Create `extensions/lib/limit-usage.ts` — pure types plus formatting, payload parsing, auth-file lookup, token refresh, and usage fetch helpers.
- Create `extensions/limit.ts` — pi extension entrypoint, polling timer, session lifecycle, and `orgm:limits-changed` event emission.
- Modify `extensions/lib/minimal-title.ts` — add a pure `renderLimitsContextLine()` helper for full/compact/truncated limits row rendering.
- Modify `extensions/minimal.ts` — listen for `orgm:limits-changed`, store current display model, and render the new limits row after the existing title context row.
- Modify `extensions/lib/orgm-extension-config.ts` — add `limit` to known ORGM extensions for `/orgm-extension limit on`, `/orgm-extension limit off`, and `/orgm-extension limit status`.
- Create `tests/limit-usage.test.ts` — pure unit tests for parsing/formatting/auth lookup.
- Modify `tests/minimal-footer-utils.test.ts` — add minimal limits row tests.
- Modify `tests/orgm-extension-config.test.ts` — assert `limit` completions/status.

---

### Task 1: Pure limit formatting and payload parsing

**Files:**
- Create: `extensions/lib/limit-usage.ts`
- Test: `tests/limit-usage.test.ts`

- [ ] **Step 1: Write failing formatter/parser tests**

Create `tests/limit-usage.test.ts` with:

```ts
import assert from "node:assert/strict";
import {
	formatLimitBar,
	formatLimitMetric,
	formatLimitsRow,
	parseUsagePayload,
	remainingPercent,
} from "../extensions/lib/limit-usage.ts";

assert.equal(remainingPercent(0), 100, "0 used means 100 remaining");
assert.equal(remainingPercent(8), 92, "8 used means 92 remaining");
assert.equal(remainingPercent(10), 90, "10 used means 90 remaining");
assert.equal(remainingPercent(100), 0, "100 used means 0 remaining");
assert.equal(remainingPercent(140), 0, "remaining clamps low");
assert.equal(remainingPercent(-20), 100, "remaining clamps high");
assert.equal(remainingPercent(undefined), undefined, "missing remains missing");

assert.equal(formatLimitBar(100), "[##########]");
assert.equal(formatLimitBar(92), "[#########-]");
assert.equal(formatLimitBar(90), "[#########-]");
assert.equal(formatLimitBar(0), "[----------]");
assert.equal(formatLimitBar(undefined), "[----------]");

assert.equal(formatLimitMetric("Codex 5H", 90), "Codex 5H [#########-] 90%");
assert.equal(formatLimitMetric("Spark S", undefined), "Spark S [----------] --%");

const payload = {
	plan_type: "pro",
	rate_limit: {
		primary_window: { used_percent: 10, reset_at: 1735401600, limit_window_seconds: 18000 },
		secondary_window: { used_percent: 8, reset_at: 1735920000, limit_window_seconds: 604800 },
	},
	additional_rate_limits: [
		{
			limit_name: "GPT-5.3-Codex-Spark",
			metered_feature: "codex_bengalfox",
			rate_limit: {
				primary_window: { used_percent: 50, reset_at: 1735401600, limit_window_seconds: 18000 },
				secondary_window: { used_percent: 20, reset_at: 1735920000, limit_window_seconds: 604800 },
			},
		},
	],
};

const parsed = parseUsagePayload(payload);
assert.equal(parsed.planType, "pro");
assert.equal(parsed.codex.primary?.remainingPercent, 90);
assert.equal(parsed.codex.secondary?.remainingPercent, 92);
assert.equal(parsed.spark.primary?.remainingPercent, 50);
assert.equal(parsed.spark.secondary?.remainingPercent, 80);

assert.equal(
	formatLimitsRow(parsed, "full"),
	"Codex 5H [#########-] 90% | Codex S [#########-] 92% | Spark 5H [#####-----] 50% | Spark S [########--] 80%",
);
assert.equal(
	formatLimitsRow(parsed, "compact"),
	"C 5H [#########-] 90% | C S [#########-] 92% | SP 5H [#####-----] 50% | SP S [########--] 80%",
);

const noSpark = parseUsagePayload({
	rate_limit: {
		primary_window: { used_percent: 0 },
		secondary_window: { used_percent: 100 },
	},
});
assert.equal(
	formatLimitsRow(noSpark, "full"),
	"Codex 5H [##########] 100% | Codex S [----------] 0% | Spark 5H [----------] --% | Spark S [----------] --%",
);
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/limit-usage.test.ts
```

Expected: FAIL with module not found for `extensions/lib/limit-usage.ts`.

- [ ] **Step 3: Implement pure helpers**

Create `extensions/lib/limit-usage.ts` with:

```ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const LIMITS_EVENT = "orgm:limits-changed";
export const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
export const CODEX_REFRESH_URL = "https://auth.openai.com/oauth/token";
export const CODEX_OAUTH_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";

export type LimitWindow = {
	usedPercent?: number;
	remainingPercent?: number;
	resetAt?: number;
	windowSeconds?: number;
};

export type LimitBucket = {
	limitId: string;
	limitName?: string;
	primary?: LimitWindow;
	secondary?: LimitWindow;
};

export type LimitSnapshot = {
	planType?: string;
	codex: LimitBucket;
	spark: LimitBucket;
	updatedAt: number;
};

export type LimitDisplayModel = {
	snapshot?: LimitSnapshot;
	fullText: string;
	compactText: string;
	stale: boolean;
	error?: string;
};

type RawWindow = {
	used_percent?: unknown;
	reset_at?: unknown;
	limit_window_seconds?: unknown;
};

type RawRateLimit = {
	primary_window?: RawWindow | null;
	secondary_window?: RawWindow | null;
};

type RawAdditionalLimit = {
	limit_name?: unknown;
	metered_feature?: unknown;
	rate_limit?: RawRateLimit | null;
};

type RawUsagePayload = {
	plan_type?: unknown;
	rate_limit?: RawRateLimit | null;
	additional_rate_limits?: RawAdditionalLimit[] | null;
};

export type CodexAuthTokens = {
	accessToken: string;
	refreshToken?: string;
	idToken?: string;
	accountId?: string;
};

export type CodexAuthFile = {
	path: string;
	raw: Record<string, unknown>;
	tokens: CodexAuthTokens;
};

function numberFrom(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringFrom(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function remainingPercent(usedPercent: number | undefined): number | undefined {
	if (usedPercent === undefined || !Number.isFinite(usedPercent)) return undefined;
	return Math.max(0, Math.min(100, Math.round(100 - usedPercent)));
}

export function formatLimitBar(percent: number | undefined, width = 10): string {
	if (percent === undefined) return `[${"-".repeat(width)}]`;
	const clamped = Math.max(0, Math.min(100, percent));
	const filled = Math.max(0, Math.min(width, Math.round(clamped / 10)));
	return `[${"#".repeat(filled)}${"-".repeat(width - filled)}]`;
}

export function formatLimitMetric(label: string, percent: number | undefined): string {
	return `${label} ${formatLimitBar(percent)} ${percent === undefined ? "--" : Math.round(percent)}%`;
}

function parseWindow(window: RawWindow | null | undefined): LimitWindow | undefined {
	if (!window) return undefined;
	const usedPercent = numberFrom(window.used_percent);
	const resetAt = numberFrom(window.reset_at);
	const windowSeconds = numberFrom(window.limit_window_seconds);
	if (usedPercent === undefined && resetAt === undefined && windowSeconds === undefined) return undefined;
	return {
		usedPercent,
		remainingPercent: remainingPercent(usedPercent),
		resetAt,
		windowSeconds,
	};
}

function parseBucket(limitId: string, limitName: string | undefined, rateLimit: RawRateLimit | null | undefined): LimitBucket {
	return {
		limitId,
		limitName,
		primary: parseWindow(rateLimit?.primary_window),
		secondary: parseWindow(rateLimit?.secondary_window),
	};
}

function findSparkLimit(additional: RawUsagePayload["additional_rate_limits"]): RawAdditionalLimit | undefined {
	if (!Array.isArray(additional)) return undefined;
	return additional.find((item) => {
		const id = stringFrom(item?.metered_feature)?.toLowerCase() ?? "";
		const name = stringFrom(item?.limit_name)?.toLowerCase() ?? "";
		return id.includes("bengalfox") || id.includes("spark") || name.includes("spark");
	});
}

export function parseUsagePayload(payload: unknown): LimitSnapshot {
	const raw = (payload && typeof payload === "object" ? payload : {}) as RawUsagePayload;
	const sparkRaw = findSparkLimit(raw.additional_rate_limits);
	return {
		planType: stringFrom(raw.plan_type),
		codex: parseBucket("codex", undefined, raw.rate_limit),
		spark: parseBucket(
			stringFrom(sparkRaw?.metered_feature) ?? "codex_bengalfox",
			stringFrom(sparkRaw?.limit_name) ?? "GPT-5.3-Codex-Spark",
			sparkRaw?.rate_limit,
		),
		updatedAt: Date.now(),
	};
}

export function formatLimitsRow(snapshot: LimitSnapshot | undefined, mode: "full" | "compact" = "full"): string {
	const codex = snapshot?.codex;
	const spark = snapshot?.spark;
	const labels = mode === "full"
		? ["Codex 5H", "Codex S", "Spark 5H", "Spark S"]
		: ["C 5H", "C S", "SP 5H", "SP S"];
	return [
		formatLimitMetric(labels[0]!, codex?.primary?.remainingPercent),
		formatLimitMetric(labels[1]!, codex?.secondary?.remainingPercent),
		formatLimitMetric(labels[2]!, spark?.primary?.remainingPercent),
		formatLimitMetric(labels[3]!, spark?.secondary?.remainingPercent),
	].join(" | ");
}

export function authFileCandidates(env: NodeJS.ProcessEnv = process.env, home = homedir()): string[] {
	const candidates: string[] = [];
	if (env.CODEX_HOME?.trim()) candidates.push(join(env.CODEX_HOME, "auth.json"));
	candidates.push(join(home, ".config", "codex", "auth.json"));
	candidates.push(join(home, ".codex", "auth.json"));
	return candidates;
}

export function readCodexAuth(env: NodeJS.ProcessEnv = process.env, home = homedir()): CodexAuthFile | undefined {
	for (const path of authFileCandidates(env, home)) {
		if (!existsSync(path)) continue;
		const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
		const tokens = raw.tokens && typeof raw.tokens === "object" ? raw.tokens as Record<string, unknown> : raw;
		const accessToken = stringFrom(tokens.access_token);
		if (!accessToken) continue;
		return {
			path,
			raw,
			tokens: {
				accessToken,
				refreshToken: stringFrom(tokens.refresh_token),
				idToken: stringFrom(tokens.id_token),
				accountId: stringFrom(tokens.account_id),
			},
		};
	}
	return undefined;
}

export function writeUpdatedAuth(auth: CodexAuthFile, next: Partial<CodexAuthTokens>): void {
	const raw = { ...auth.raw };
	const existingTokens = raw.tokens && typeof raw.tokens === "object" ? raw.tokens as Record<string, unknown> : {};
	raw.tokens = {
		...existingTokens,
		access_token: next.accessToken ?? auth.tokens.accessToken,
		refresh_token: next.refreshToken ?? auth.tokens.refreshToken,
		id_token: next.idToken ?? auth.tokens.idToken,
		account_id: next.accountId ?? auth.tokens.accountId,
	};
	raw.last_refresh = new Date().toISOString();
	writeFileSync(auth.path, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
}

export async function refreshAccessToken(refreshToken: string, fetchImpl: typeof fetch = fetch): Promise<Partial<CodexAuthTokens> | undefined> {
	const body = new URLSearchParams({
		client_id: CODEX_OAUTH_CLIENT_ID,
		grant_type: "refresh_token",
		refresh_token: refreshToken,
	});
	const response = await fetchImpl(CODEX_REFRESH_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "codex-cli" },
		body,
	});
	if (!response.ok) return undefined;
	const payload = await response.json() as Record<string, unknown>;
	return {
		accessToken: stringFrom(payload.access_token),
		refreshToken: stringFrom(payload.refresh_token),
		idToken: stringFrom(payload.id_token),
	};
}

export async function fetchUsageSnapshot(auth: CodexAuthFile, fetchImpl: typeof fetch = fetch): Promise<LimitSnapshot> {
	const request = async (accessToken: string) => fetchImpl(CODEX_USAGE_URL, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/json",
			"User-Agent": "codex-cli",
			...(auth.tokens.accountId ? { "ChatGPT-Account-Id": auth.tokens.accountId } : {}),
		},
	});

	let response = await request(auth.tokens.accessToken);
	if (response.status === 401 && auth.tokens.refreshToken) {
		const refreshed = await refreshAccessToken(auth.tokens.refreshToken, fetchImpl);
		if (refreshed?.accessToken) {
			writeUpdatedAuth(auth, refreshed);
			response = await request(refreshed.accessToken);
		}
	}
	if (!response.ok) throw new Error(`Usage fetch failed: ${response.status}`);
	return parseUsagePayload(await response.json());
}

export function displayModel(snapshot: LimitSnapshot | undefined, stale = false, error?: string): LimitDisplayModel {
	return {
		snapshot,
		fullText: formatLimitsRow(snapshot, "full"),
		compactText: formatLimitsRow(snapshot, "compact"),
		stale,
		error,
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test tests/limit-usage.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit pure helpers**

Run:

```bash
git add extensions/lib/limit-usage.ts tests/limit-usage.test.ts
git commit -m "feat: add limit usage helpers"
```

---

### Task 2: Auth lookup tests

**Files:**
- Modify: `tests/limit-usage.test.ts`
- Modify: `extensions/lib/limit-usage.ts`

- [ ] **Step 1: Add failing auth lookup tests**

Append to `tests/limit-usage.test.ts`:

```ts
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { authFileCandidates, readCodexAuth } from "../extensions/lib/limit-usage.ts";

const tempDir = mkdtempSync(join(tmpdir(), "limit-auth-"));
try {
	const codeHome = join(tempDir, "codex-home");
	const fakeHome = join(tempDir, "home");
	mkdirSync(codeHome, { recursive: true });
	mkdirSync(join(fakeHome, ".config", "codex"), { recursive: true });
	mkdirSync(join(fakeHome, ".codex"), { recursive: true });

	assert.deepEqual(authFileCandidates({ CODEX_HOME: codeHome }, fakeHome), [
		join(codeHome, "auth.json"),
		join(fakeHome, ".config", "codex", "auth.json"),
		join(fakeHome, ".codex", "auth.json"),
	]);

	writeFileSync(join(fakeHome, ".codex", "auth.json"), JSON.stringify({
		tokens: {
			access_token: "fallback-access",
			refresh_token: "fallback-refresh",
			account_id: "fallback-account",
		},
	}), "utf8");
	writeFileSync(join(codeHome, "auth.json"), JSON.stringify({
		tokens: {
			access_token: "primary-access",
			refresh_token: "primary-refresh",
			account_id: "primary-account",
		},
	}), "utf8");

	const auth = readCodexAuth({ CODEX_HOME: codeHome }, fakeHome);
	assert.equal(auth?.tokens.accessToken, "primary-access");
	assert.equal(auth?.tokens.refreshToken, "primary-refresh");
	assert.equal(auth?.tokens.accountId, "primary-account");
} finally {
	rmSync(tempDir, { recursive: true, force: true });
}
```

- [ ] **Step 2: Run auth tests**

Run:

```bash
node --test tests/limit-usage.test.ts
```

Expected: PASS if Task 1 implementation included auth helpers; if duplicate imports cause syntax failure, merge import lists at top of `tests/limit-usage.test.ts` and rerun.

- [ ] **Step 3: Commit auth tests**

Run:

```bash
git add tests/limit-usage.test.ts extensions/lib/limit-usage.ts
git commit -m "test: cover codex auth lookup"
```

---

### Task 3: Minimal limits row rendering helper

**Files:**
- Modify: `extensions/lib/minimal-title.ts`
- Modify: `tests/minimal-footer-utils.test.ts`

- [ ] **Step 1: Write failing row rendering tests**

Modify imports in `tests/minimal-footer-utils.test.ts` from:

```ts
import { visibleWidth } from "../extensions/lib/minimal-title.ts";
```

to:

```ts
import { renderLimitsContextLine, visibleWidth } from "../extensions/lib/minimal-title.ts";
```

Append:

```ts
const fullLimitText = "Codex 5H [#########-] 90% | Codex S [#########-] 92% | Spark 5H [#####-----] 50% | Spark S [########--] 80%";
const compactLimitText = "C 5H [#########-] 90% | C S [#########-] 92% | SP 5H [#####-----] 50% | SP S [########--] 80%";

assert.equal(renderLimitsContextLine(160, fullLimitText, compactLimitText, style), fullLimitText, "wide limit row should render full labels");
assert.equal(renderLimitsContextLine(100, fullLimitText, compactLimitText, style), compactLimitText, "medium limit row should render compact labels");
const tinyLimitLine = renderLimitsContextLine(32, fullLimitText, compactLimitText, style);
assert(visibleWidth(tinyLimitLine) <= 32, "tiny limit row should fit width");
assert(tinyLimitLine.endsWith("…"), "tiny limit row should truncate with ellipsis");
assert.equal(renderLimitsContextLine(0, fullLimitText, compactLimitText, style), "", "zero-width limit row should be empty");
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/minimal-footer-utils.test.ts
```

Expected: FAIL with missing export `renderLimitsContextLine`.

- [ ] **Step 3: Implement rendering helper**

Append to `extensions/lib/minimal-title.ts`:

```ts
export function renderLimitsContextLine(
	width: number,
	fullText: string,
	compactText: string,
	style: (kind: "dim", text: string) => string,
): string {
	if (width <= 0) return "";
	if (visibleWidth(fullText) <= width) return style("dim", fullText);
	if (visibleWidth(compactText) <= width) return style("dim", compactText);
	return style("dim", truncateToWidth(compactText, width));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test tests/minimal-footer-utils.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit minimal row helper**

Run:

```bash
git add extensions/lib/minimal-title.ts tests/minimal-footer-utils.test.ts
git commit -m "feat: render minimal limit row"
```

---

### Task 4: `limit.ts` extension runtime

**Files:**
- Create: `extensions/limit.ts`
- Modify: `tests/limit-usage.test.ts`

- [ ] **Step 1: Add extension source guard test**

Append to `tests/limit-usage.test.ts`:

```ts
import { readFileSync } from "node:fs";

const limitExtensionSource = readFileSync(new URL("../extensions/limit.ts", import.meta.url), "utf8");
assert(limitExtensionSource.includes('isOrgmExtensionEnabled("limit")'), "limit extension should be gated by orgm extension config");
assert(limitExtensionSource.includes("LIMITS_EVENT"), "limit extension should emit limits event");
assert(limitExtensionSource.includes("setInterval"), "limit extension should refresh on an interval");
assert(limitExtensionSource.includes("session_shutdown"), "limit extension should cleanup timer on shutdown");
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/limit-usage.test.ts
```

Expected: FAIL with missing `extensions/limit.ts`.

- [ ] **Step 3: Implement extension runtime**

Create `extensions/limit.ts` with:

```ts
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { isOrgmExtensionEnabled } from "./lib/orgm-extension-config.ts";
import {
	LIMITS_EVENT,
	displayModel,
	fetchUsageSnapshot,
	readCodexAuth,
	type LimitSnapshot,
} from "./lib/limit-usage.ts";

const REFRESH_INTERVAL_MS = 120_000;

export default function (pi: ExtensionAPI) {
	if (!isOrgmExtensionEnabled("limit")) return;

	let timer: ReturnType<typeof setInterval> | undefined;
	let lastSnapshot: LimitSnapshot | undefined;
	let warnedAuth = false;
	let currentCtx: ExtensionContext | undefined;

	const emit = (ctx: ExtensionContext, stale = false, error?: string) => {
		pi.events.emit(LIMITS_EVENT, displayModel(lastSnapshot, stale, error));
		if (ctx.hasUI) ctx.ui.setStatus("orgm-limit", undefined);
	};

	const refresh = async (ctx: ExtensionContext) => {
		currentCtx = ctx;
		const auth = readCodexAuth();
		if (!auth) {
			emit(ctx, false, "missing-auth");
			if (!warnedAuth && ctx.hasUI) {
				warnedAuth = true;
				ctx.ui.notify("Codex auth not found; limits unavailable", "warning");
			}
			return;
		}
		try {
			lastSnapshot = await fetchUsageSnapshot(auth);
			emit(ctx, false);
		} catch {
			emit(ctx, Boolean(lastSnapshot), "fetch-failed");
		}
	};

	const stopTimer = () => {
		if (timer) clearInterval(timer);
		timer = undefined;
	};

	const startTimer = (ctx: ExtensionContext) => {
		stopTimer();
		timer = setInterval(() => {
			void refresh(ctx);
		}, REFRESH_INTERVAL_MS);
	};

	pi.on("session_start", async (_event, ctx) => {
		if (!ctx.hasUI) return;
		currentCtx = ctx;
		emit(ctx, false);
		await refresh(ctx);
		startTimer(ctx);
	});

	pi.on("model_select", async (_event, ctx) => {
		if (!ctx.hasUI) return;
		await refresh(ctx);
	});

	pi.on("session_shutdown", async () => {
		stopTimer();
		currentCtx = undefined;
	});

	pi.registerCommand("orgm-limits", {
		description: "Refresh Codex and Spark usage limit display",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) return;
			await refresh(ctx);
			ctx.ui.notify("Limits refreshed", "success");
		},
	});
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test tests/limit-usage.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit extension runtime**

Run:

```bash
git add extensions/limit.ts tests/limit-usage.test.ts
git commit -m "feat: add limit extension runtime"
```

---

### Task 5: Minimal footer integration

**Files:**
- Modify: `extensions/minimal.ts`
- Modify: `tests/minimal-footer-utils.test.ts`

- [ ] **Step 1: Add failing source assertions for integration**

Append to `tests/minimal-footer-utils.test.ts`:

```ts
assert(minimalSource.includes("LIMITS_EVENT"), "minimal footer should listen for limits event");
assert(minimalSource.includes("renderLimitsContextLine"), "minimal footer should render new limits context line");
assert(minimalSource.includes("currentLimits"), "minimal footer should keep latest limit display model");
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/minimal-footer-utils.test.ts
```

Expected: FAIL because `minimal.ts` does not yet include `LIMITS_EVENT`.

- [ ] **Step 3: Import limit types/helpers in `extensions/minimal.ts`**

Change the `minimal-title.ts` import to include `renderLimitsContextLine`:

```ts
import {
	renderLimitsContextLine,
	renderTitleContextLine,
	sanitizeTitle,
	SESSION_TITLE_ENTRY_TYPE,
	TITLE_STATE_EVENT,
	type TitleStatus,
} from "./lib/minimal-title.ts";
```

Add this import:

```ts
import { LIMITS_EVENT, displayModel, type LimitDisplayModel } from "./lib/limit-usage.ts";
```

- [ ] **Step 4: Add state and event listener in `extensions/minimal.ts`**

After `let titleStatus: TitleStatus = { state: "idle" };`, add:

```ts
	let currentLimits: LimitDisplayModel = displayModel(undefined);
```

Before the existing `pi.on("session_start", async (_event, ctx) => {` block, add:

```ts
	pi.events.on(LIMITS_EVENT, (data: LimitDisplayModel) => {
		currentLimits = data?.fullText && data?.compactText ? data : displayModel(undefined);
		requestRender();
	});
```

- [ ] **Step 5: Render new limits row**

Replace:

```ts
					const lines = [firstLine, renderTitleStatusLine(theme, titleStatus, width, folderLabel, modeLabel, currentModeColors)];
```

with:

```ts
					const lines = [
						firstLine,
						renderTitleStatusLine(theme, titleStatus, width, folderLabel, modeLabel, currentModeColors),
						renderLimitsContextLine(width, currentLimits.fullText, currentLimits.compactText, (kind, text) => theme.fg("text", text)),
					];
```

- [ ] **Step 6: Run test to verify it passes**

Run:

```bash
node --test tests/minimal-footer-utils.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit minimal integration**

Run:

```bash
git add extensions/minimal.ts tests/minimal-footer-utils.test.ts
git commit -m "feat: show limits in minimal footer"
```

---

### Task 6: ORGM extension gating

**Files:**
- Modify: `extensions/lib/orgm-extension-config.ts`
- Modify: `tests/orgm-extension-config.test.ts`

- [ ] **Step 1: Add failing config tests**

In `tests/orgm-extension-config.test.ts`, after the title default assertion, add:

```ts
	assert.equal(isOrgmExtensionEnabled("limit", defaultConfig), true, "limit extension should default on");
```

After this existing line:

```ts
	const todoCompletions = buildOrgmExtensionCommandCompletions("todo ").map((item) => item.value);
```

add:

```ts
	const limitCompletions = buildOrgmExtensionCommandCompletions("limit ").map((item) => item.value);
	assert(limitCompletions.includes("limit on"), "autocomplete should include limit on");
	assert(limitCompletions.includes("limit off"), "autocomplete should include limit off");
```

- [ ] **Step 2: Run test to verify autocomplete failure**

Run:

```bash
node --test tests/orgm-extension-config.test.ts
```

Expected: FAIL because completions do not include `limit on`.

- [ ] **Step 3: Add `limit` to known extension config**

In `extensions/lib/orgm-extension-config.ts`, add this entry near other top-level extensions:

```ts
	limit: [],
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test tests/orgm-extension-config.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit gating**

Run:

```bash
git add extensions/lib/orgm-extension-config.ts tests/orgm-extension-config.test.ts
git commit -m "feat: gate limit extension"
```

---

### Task 7: Full verification

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run focused tests**

Run:

```bash
node --test tests/limit-usage.test.ts tests/minimal-footer-utils.test.ts tests/orgm-extension-config.test.ts tests/orgm-extension-gating.test.ts
```

Expected: all tests PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
node --test tests/*.test.ts
```

Expected: all tests PASS.

- [ ] **Step 3: Check diff and status**

Run:

```bash
git status --short
git diff --check
git log --oneline -6
```

Expected: clean diff check; git status either clean or only intended uncommitted plan/doc changes.

- [ ] **Step 4: Final commit if verification-only changes exist**

If verification exposed minor fixes, commit them with:

```bash
git add extensions tests
git commit -m "fix: harden limit display"
```

Expected: no commit created if there were no verification fixes.

---

## Self-Review

Spec coverage:

- New third context row: Task 3 and Task 5.
- Codex/Spark 5H/S metrics: Task 1 parser/formatter and Task 5 rendering.
- Official `/wham/usage` endpoint and OAuth: Task 1 and Task 2.
- Refresh lifecycle: Task 4.
- ORGM extension gating: Task 6.
- Error handling and no token logging: Task 1/4 code paths avoid logging raw auth and fall back to unavailable display.
- Tests: Tasks 1, 2, 3, 5, 6, 7.

Placeholder scan: no placeholder implementation steps are left; every code-writing step includes exact snippets.

Type consistency: shared event name is `LIMITS_EVENT`; display object is `LimitDisplayModel`; minimal state is `currentLimits`; render helper is `renderLimitsContextLine`.
