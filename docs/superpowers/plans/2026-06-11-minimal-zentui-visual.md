# Minimal Zentui Visual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `minimal.ts` visual UI around Zentui-style editor chrome and Starship footer while keeping title/timer/caveman and making ChatGPT/Codex limits command-only inline output.

**Architecture:** Keep `minimal.ts` as the integration owner. Extract pure Starship formatting into `extensions/lib/starship.ts`, extract editor wrapper helpers into `extensions/lib/zentui-editor.ts`, and move limit display into command-only inline rendering in `extensions/limit.ts`. Tests stay as direct Node assertion scripts using `node --experimental-strip-types`.

**Tech Stack:** TypeScript Pi extensions, `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, Node built-ins, direct `node:assert/strict` tests.

---

## File Structure

- Create `extensions/lib/starship.ts`
  - Pure git porcelain parsing.
  - Runtime detection from project files and command output.
  - Width-safe Starship line formatter.
- Create `tests/starship.test.ts`
  - Unit tests for git indicators, runtime detection, and line truncation.
- Create `extensions/lib/zentui-editor.ts`
  - Custom editor wrapper and pure metadata formatting helpers.
- Create `tests/zentui-editor.test.ts`
  - Unit tests for editor metadata formatting and source-level integration guards.
- Modify `extensions/minimal.ts`
  - Install Zentui-style editor wrapper.
  - Replace mixed old footer first line with Starship line.
  - Remove limit event/footer rendering.
  - Keep title/timer/caveman as minimal-extra line.
- Modify `tests/minimal-footer-utils.test.ts`
  - Update assertions for no persistent limits.
  - Add assertions for Starship + editor integration.
- Modify `extensions/limit.ts`
  - Remove startup/timer/status behavior.
  - Render `/orgm-limits` result inline through custom message renderer.
- Create `tests/limit-inline.test.ts`
  - Source-level and pure-helper tests for command-only inline behavior.

---

### Task 1: Starship Pure Formatter

**Files:**
- Create: `extensions/lib/starship.ts`
- Create: `tests/starship.test.ts`

- [ ] **Step 1: Write failing Starship tests**

Create `tests/starship.test.ts`:

```ts
import assert from "node:assert/strict";
import {
	buildStarshipLine,
	detectRuntimeFromEntries,
	formatGitStatusIndicators,
	parseGitStatusPorcelain,
	visibleWidth,
} from "../extensions/lib/starship.ts";

const porcelain = [
	"# branch.oid 123456",
	"# branch.head main",
	"# branch.upstream origin/main",
	"# branch.ab +2 -1",
	"1 M. N... 100644 100644 100644 a b file.ts",
	"1 .D N... 100644 100644 000000 a b deleted.ts",
	"1 A. N... 000000 100644 100644 a b added.ts",
	"2 R. N... 100644 100644 100644 a b R100 old.ts\tnew.ts",
	"? untracked.ts",
	"u UU N... 100644 100644 100644 100644 a b c conflict.ts",
].join("\n");

const status = parseGitStatusPorcelain(porcelain, true);
assert.equal(status.branch, "main", "branch should parse from porcelain v2 header");
assert.equal(status.ahead, 2, "ahead count should parse");
assert.equal(status.behind, 1, "behind count should parse");
assert.equal(status.modified, 1, "modified worktree count should parse");
assert.equal(status.deleted, 1, "deleted count should parse");
assert.equal(status.staged, 1, "staged count should parse");
assert.equal(status.renamed, 1, "renamed count should parse");
assert.equal(status.untracked, 1, "untracked count should parse");
assert.equal(status.conflicted, 1, "conflicted count should parse");
assert.equal(status.stashed, true, "stash flag should be preserved");
assert.equal(formatGitStatusIndicators(status), "[!?+✘»=$⇕]", "dirty status should render compact indicators with diverged arrow");

assert.equal(formatGitStatusIndicators({ ...status, ahead: 0, behind: 0 }), "[!?+✘»=$]", "non-diverged status should omit arrows when clean relative to remote");
assert.equal(formatGitStatusIndicators({ ...status, modified: 0, deleted: 0, staged: 0, renamed: 0, untracked: 0, conflicted: 0, stashed: false, ahead: 1, behind: 0 }), "[↑]", "ahead-only status should show up arrow");
assert.equal(formatGitStatusIndicators({ ...status, modified: 0, deleted: 0, staged: 0, renamed: 0, untracked: 0, conflicted: 0, stashed: false, ahead: 0, behind: 1 }), "[↓]", "behind-only status should show down arrow");
assert.equal(formatGitStatusIndicators({ ...status, modified: 0, deleted: 0, staged: 0, renamed: 0, untracked: 0, conflicted: 0, stashed: false, ahead: 0, behind: 0 }), "", "clean status should render no bracket");

const runtime = detectRuntimeFromEntries(["package.json", "README.md"], { nodeVersion: "v22.22.1" });
assert.deepEqual(runtime, { name: "node", symbol: "", version: "v22.22.1" }, "package.json should detect Node runtime");

const line = buildStarshipLine({
	cwd: "/home/osmarg/Code/pi-harness",
	git: status,
	runtime,
	extensionStatuses: new Map([["mcp", "mcp:2"], ["orgm-limit", "hidden"]]),
	contextLabel: "42%/200k",
	tokenLabel: "↑1.2k ↓800",
	costLabel: "$0.003",
	width: 120,
	style: (_kind, text) => text,
});
assert(line.includes("󰝰 pi-harness"), "line should include cwd segment");
assert(line.includes("on  main [!?+✘»=$⇕]"), "line should include git branch and indicators");
assert(line.includes("via  v22.22.1"), "line should include runtime segment");
assert(line.includes("mcp:2"), "line should include external statuses");
assert(!line.includes("orgm-limit"), "line should hide orgm-limit internal status");
assert(line.includes("42%/200k"), "line should include context label");
assert(line.includes("↑1.2k ↓800"), "line should include token label");
assert(line.includes("$0.003"), "line should include cost label");
assert(visibleWidth(line) <= 120, "wide line should fit width");

const narrow = buildStarshipLine({
	cwd: "/home/osmarg/Code/pi-harness",
	git: status,
	runtime,
	extensionStatuses: new Map([["mcp", "mcp:2"]]),
	contextLabel: "42%/200k",
	tokenLabel: "↑1.2k ↓800",
	costLabel: "$0.003",
	width: 36,
	style: (_kind, text) => text,
});
assert(visibleWidth(narrow) <= 36, "narrow line should fit width");
assert(narrow.endsWith("…") || visibleWidth(narrow) < 36, "narrow line should truncate gracefully");
```

- [ ] **Step 2: Run Starship tests and verify RED**

Run:

```bash
node --experimental-strip-types tests/starship.test.ts
```

Expected: FAIL with module not found for `../extensions/lib/starship.ts`.

- [ ] **Step 3: Implement minimal Starship formatter**

Create `extensions/lib/starship.ts`:

```ts
import { basename } from "node:path";

const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;

export type StarshipStyleKind =
	| "cwd"
	| "git"
	| "gitStatus"
	| "runtimePrefix"
	| "runtime"
	| "status"
	| "context"
	| "tokens"
	| "cost"
	| "separator";

export type StarshipGitStatus = {
	branch?: string;
	dirty: boolean;
	ahead: number;
	behind: number;
	conflicted: number;
	untracked: number;
	stashed: boolean;
	modified: number;
	staged: number;
	renamed: number;
	deleted: number;
	typechanged: number;
};

export type StarshipRuntime = {
	name: string;
	symbol: string;
	version?: string;
};

export type BuildStarshipLineInput = {
	cwd: string;
	git?: StarshipGitStatus;
	runtime?: StarshipRuntime;
	extensionStatuses?: ReadonlyMap<string, string>;
	contextLabel: string;
	tokenLabel: string;
	costLabel: string;
	width: number;
	style: (kind: StarshipStyleKind, text: string) => string;
};

export function visibleWidth(text: string): number {
	return Array.from(text.replace(ANSI_PATTERN, "")).length;
}

export function truncateToWidth(text: string, width: number): string {
	if (width <= 0) return "";
	if (visibleWidth(text) <= width) return text;
	const plain = Array.from(text.replace(ANSI_PATTERN, ""));
	if (width === 1) return "…";
	return `${plain.slice(0, width - 1).join("")}…`;
}

export function emptyGitStatus(): StarshipGitStatus {
	return {
		branch: undefined,
		dirty: false,
		ahead: 0,
		behind: 0,
		conflicted: 0,
		untracked: 0,
		stashed: false,
		modified: 0,
		staged: 0,
		renamed: 0,
		deleted: 0,
		typechanged: 0,
	};
}

export function parseGitStatusPorcelain(stdoutText: string, hasStash: boolean): StarshipGitStatus {
	const status = emptyGitStatus();
	status.stashed = hasStash;
	for (const line of stdoutText.split("\n")) {
		if (!line) continue;
		if (line.startsWith("# branch.head ")) {
			const branch = line.slice("# branch.head ".length).trim();
			status.branch = branch && branch !== "(detached)" ? branch : undefined;
			continue;
		}
		if (line.startsWith("# branch.ab ")) {
			const match = line.match(/\+(\d+)\s+-(\d+)/);
			if (match) {
				status.ahead = Number(match[1] ?? 0);
				status.behind = Number(match[2] ?? 0);
			}
			continue;
		}
		if (line.startsWith("? ")) {
			status.dirty = true;
			status.untracked += 1;
			continue;
		}
		if (line.startsWith("u ")) {
			status.dirty = true;
			status.conflicted += 1;
			continue;
		}
		if (!line.startsWith("1 ") && !line.startsWith("2 ")) continue;
		status.dirty = true;
		const xy = line.slice(2, 4);
		const x = xy[0] ?? " ";
		const y = xy[1] ?? " ";
		if (x === "R") status.renamed += 1;
		else if (x === "D") status.deleted += 1;
		else if (x === "T") status.typechanged += 1;
		else if (x !== "." && x !== " ") status.staged += 1;
		if (y === "M") status.modified += 1;
		else if (y === "D") status.deleted += 1;
		else if (y === "T") status.typechanged += 1;
	}
	return status;
}

export function formatGitStatusIndicators(status: StarshipGitStatus): string {
	const parts: string[] = [];
	if (status.modified > 0 || status.typechanged > 0) parts.push("!");
	if (status.untracked > 0) parts.push("?");
	if (status.staged > 0) parts.push("+");
	if (status.deleted > 0) parts.push("✘");
	if (status.renamed > 0) parts.push("»");
	if (status.conflicted > 0) parts.push("=");
	if (status.stashed) parts.push("$");
	if (status.ahead > 0 && status.behind > 0) parts.push("⇕");
	else if (status.ahead > 0) parts.push("↑");
	else if (status.behind > 0) parts.push("↓");
	return parts.length > 0 ? `[${parts.join("")}]` : "";
}

export function detectRuntimeFromEntries(entries: string[], env: { nodeVersion?: string } = {}): StarshipRuntime | undefined {
	if (entries.includes("package.json") || entries.includes(".node-version") || entries.includes(".nvmrc")) {
		return { name: "node", symbol: "", version: env.nodeVersion ?? process.version };
	}
	if (entries.includes("bun.lock") || entries.includes("bun.lockb")) return { name: "bun", symbol: "" };
	if (entries.includes("go.mod")) return { name: "go", symbol: "" };
	if (entries.includes("Cargo.toml")) return { name: "rust", symbol: "" };
	if (entries.includes("pyproject.toml") || entries.includes("requirements.txt")) return { name: "python", symbol: "" };
	return undefined;
}

function formatCwd(cwd: string): string {
	const normalized = cwd.replace(/[\\/]+$/, "");
	return `󰝰 ${basename(normalized) || normalized || "."}`;
}

function visibleJoin(parts: string[], separator: string): string {
	return parts.filter(Boolean).join(separator);
}

export function buildStarshipLine(input: BuildStarshipLineInput): string {
	if (input.width <= 0) return "";
	const separator = input.style("separator", " · ");
	const leftParts: string[] = [input.style("cwd", formatCwd(input.cwd))];
	if (input.git?.branch) {
		const indicators = formatGitStatusIndicators(input.git);
		leftParts.push(input.style("git", `on  ${input.git.branch}`) + (indicators ? ` ${input.style("gitStatus", indicators)}` : ""));
	}
	if (input.runtime) {
		const label = input.runtime.version ? `${input.runtime.symbol} ${input.runtime.version}` : input.runtime.symbol;
		leftParts.push(`${input.style("runtimePrefix", "via")} ${input.style("runtime", label)}`);
	}
	const statuses = [...(input.extensionStatuses ?? new Map()).entries()]
		.filter(([key, value]) => key !== "orgm-limit" && key !== "orgm-minimal" && Boolean(value))
		.map(([, value]) => input.style("status", value));
	leftParts.push(...statuses);

	const rightParts = [
		input.style("context", input.contextLabel),
		input.style("tokens", input.tokenLabel),
		input.style("cost", input.costLabel),
	];
	const left = visibleJoin(leftParts, separator);
	const right = visibleJoin(rightParts, separator);
	const gap = input.width - visibleWidth(left) - visibleWidth(right);
	if (gap >= 2) return `${left}${" ".repeat(gap)}${right}`;
	return truncateToWidth(visibleJoin([...leftParts, ...rightParts], separator), input.width);
}
```

- [ ] **Step 4: Run Starship tests and verify GREEN**

Run:

```bash
node --experimental-strip-types tests/starship.test.ts
```

Expected: no assertion error. Node may print the existing `MODULE_TYPELESS_PACKAGE_JSON` warning.

- [ ] **Step 5: Commit Starship helper**

```bash
git add extensions/lib/starship.ts tests/starship.test.ts
git commit -m "feat(minimal): add starship footer formatter"
```

---

### Task 2: Zentui-style Editor Helpers

**Files:**
- Create: `extensions/lib/zentui-editor.ts`
- Create: `tests/zentui-editor.test.ts`

- [ ] **Step 1: Write failing editor helper tests**

Create `tests/zentui-editor.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	composeEditorMetaLine,
	formatProviderLabel,
	formatThinkingLabel,
	visibleWidth,
} from "../extensions/lib/zentui-editor.ts";

assert.equal(formatProviderLabel("openai-codex"), "OpenAI", "OpenAI Codex provider should display as OpenAI");
assert.equal(formatProviderLabel("anthropic"), "Anthropic", "Anthropic provider should display nicely");
assert.equal(formatProviderLabel("minimax-cn"), "Minimax Cn", "unknown providers should title-case words");
assert.equal(formatProviderLabel(undefined), "Unknown", "missing provider should display Unknown");

assert.equal(formatThinkingLabel("off"), "thinking off", "off thinking should be explicit");
assert.equal(formatThinkingLabel("xhigh"), "thinking xhigh", "xhigh thinking should display level");

const meta = composeEditorMetaLine({
	modelLabel: "gpt-5.3-codex",
	providerLabel: "OpenAI",
	thinkingLabel: "thinking high",
	width: 80,
	style: (_kind, text) => text,
});
assert(meta.includes("gpt-5.3-codex"), "meta should include model");
assert(meta.includes("OpenAI"), "meta should include provider");
assert(meta.includes("thinking high"), "meta should include thinking");
assert(visibleWidth(meta) <= 80, "meta should fit width");

const narrow = composeEditorMetaLine({
	modelLabel: "very-long-model-name-that-does-not-fit",
	providerLabel: "OpenAI",
	thinkingLabel: "thinking xhigh",
	width: 24,
	style: (_kind, text) => text,
});
assert(visibleWidth(narrow) <= 24, "narrow meta should fit width");
assert(narrow.endsWith("…") || visibleWidth(narrow) < 24, "narrow meta should truncate gracefully");

const source = readFileSync(new URL("../extensions/lib/zentui-editor.ts", import.meta.url), "utf8");
assert(source.includes("CustomEditor"), "zentui editor helper should wrap Pi CustomEditor");
assert(source.includes("createZentuiEditorFactory"), "zentui editor helper should expose factory creator");
```

- [ ] **Step 2: Run editor tests and verify RED**

Run:

```bash
node --experimental-strip-types tests/zentui-editor.test.ts
```

Expected: FAIL with module not found for `../extensions/lib/zentui-editor.ts`.

- [ ] **Step 3: Implement editor helper and wrapper**

Create `extensions/lib/zentui-editor.ts`:

```ts
import { CustomEditor, type KeybindingsManager, type Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth as tuiTruncateToWidth } from "@earendil-works/pi-tui";

const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;

export type EditorMetaStyleKind = "border" | "model" | "provider" | "thinking" | "text";

export type EditorMetaInput = {
	modelLabel: string;
	providerLabel: string;
	thinkingLabel: string;
	width: number;
	style: (kind: EditorMetaStyleKind, text: string) => string;
};

export type ZentuiEditorMetaGetter = () => {
	modelLabel: string;
	providerLabel: string;
	thinkingLabel: string;
};

export function visibleWidth(text: string): number {
	return Array.from(text.replace(ANSI_PATTERN, "")).length;
}

export function truncateToWidth(text: string, width: number): string {
	if (width <= 0) return "";
	if (visibleWidth(text) <= width) return text;
	const chars = Array.from(text.replace(ANSI_PATTERN, ""));
	if (width === 1) return "…";
	return `${chars.slice(0, width - 1).join("")}…`;
}

export function formatProviderLabel(provider: string | undefined): string {
	if (!provider) return "Unknown";
	const known: Record<string, string> = {
		anthropic: "Anthropic",
		gemini: "Google",
		google: "Google",
		ollama: "Ollama",
		openai: "OpenAI",
		"openai-codex": "OpenAI",
	};
	return known[provider] ?? provider.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatThinkingLabel(level: string | undefined): string {
	return `thinking ${level || "off"}`;
}

export function composeEditorMetaLine(input: EditorMetaInput): string {
	const text = `${input.modelLabel} · ${input.providerLabel} · ${input.thinkingLabel}`;
	return input.style("text", truncateToWidth(text, input.width));
}

function fillLine(content: string, width: number): string {
	const clipped = truncateToWidth(content, width);
	return `${clipped}${" ".repeat(Math.max(0, width - visibleWidth(clipped)))}`;
}

export class ZentuiEditor extends CustomEditor {
	constructor(
		private readonly theme: Theme,
		keybindings: KeybindingsManager,
		private readonly getMeta: ZentuiEditorMetaGetter,
	) {
		super(theme, keybindings);
	}

	render(width: number): string[] {
		const innerWidth = Math.max(1, width - 2);
		const baseLines = super.render(innerWidth).map((line) => tuiTruncateToWidth(line, innerWidth, ""));
		const meta = composeEditorMetaLine({
			...this.getMeta(),
			width: Math.max(1, innerWidth - 2),
			style: (kind, text) => {
				if (kind === "text") return this.theme.fg("accent", text);
				return text;
			},
		});
		const topLabel = ` ${meta} `;
		const topRest = "─".repeat(Math.max(0, innerWidth - visibleWidth(topLabel)));
		const top = this.theme.fg("borderMuted", `╭${topRest}`) + topLabel + this.theme.fg("borderMuted", "╮");
		const body = baseLines.length > 0 ? baseLines : [""];
		const boxedBody = body.map((line) => this.theme.fg("borderMuted", "│") + fillLine(line, innerWidth) + this.theme.fg("borderMuted", "│"));
		const bottom = this.theme.fg("borderMuted", `╰${"─".repeat(innerWidth)}╯`);
		return [top, ...boxedBody, bottom].map((line) => tuiTruncateToWidth(line, width, ""));
	}
}

export function createZentuiEditorFactory(getMeta: ZentuiEditorMetaGetter) {
	return (_tui: unknown, theme: Theme, keybindings: KeybindingsManager) => new ZentuiEditor(theme, keybindings, getMeta);
}
```

- [ ] **Step 4: Run editor tests and verify GREEN**

Run:

```bash
node --experimental-strip-types tests/zentui-editor.test.ts
```

Expected: no assertion error. Node may print the existing `MODULE_TYPELESS_PACKAGE_JSON` warning.

- [ ] **Step 5: Commit editor helper**

```bash
git add extensions/lib/zentui-editor.ts tests/zentui-editor.test.ts
git commit -m "feat(minimal): add zentui editor wrapper"
```

---

### Task 3: Integrate Starship Footer and Editor into Minimal

**Files:**
- Modify: `extensions/minimal.ts`
- Modify: `tests/minimal-footer-utils.test.ts`

- [ ] **Step 1: Update minimal tests for desired integration and verify RED**

Edit `tests/minimal-footer-utils.test.ts`:

1. Change imports:

```ts
import { renderSkillChipRows } from "../extensions/lib/minimal-skill.ts";
import { visibleWidth } from "../extensions/lib/minimal-title.ts";
import { formatObservedCavemanStatus, normalizeObservedCavemanState } from "../extensions/lib/caveman-state.ts";
import { formatMinimalModeLabel, formatMinimalTokenSummary } from "../extensions/minimal.ts";
```

2. Replace the old limits assertions:

```ts
assert(!minimalSource.includes("LIMITS_EVENT"), "minimal footer should not listen for command-only limits event");
assert(!minimalSource.includes("renderLimitsContextLine"), "minimal footer should not render persistent limit rows");
assert(!minimalSource.includes("currentLimits"), "minimal footer should not keep persistent limit display model");
assert(minimalSource.includes("buildStarshipLine"), "minimal footer should render Starship line");
assert(minimalSource.includes("readStarshipProjectState"), "minimal footer should refresh project git/runtime state");
assert(minimalSource.includes("createZentuiEditorFactory"), "minimal extension should install Zentui-style editor");
assert(minimalSource.includes("ctx.ui.setEditorComponent"), "minimal extension should set editor component");
assert(minimalSource.includes("renderMinimalExtraLine"), "minimal extension should render title/timer/caveman on separate line");
```

3. Delete the block of `fullLimitRows`, `compactLimitRows`, `renderLimitsContextLine`, and threshold/exhausted limit rendering assertions from this file. Those limit formatting tests stay covered by `tests/limit-usage.test.ts` and new command-inline tests.

Run:

```bash
node --experimental-strip-types tests/minimal-footer-utils.test.ts
```

Expected: FAIL because `minimal.ts` still imports `LIMITS_EVENT`, `renderLimitsContextLine`, and does not import Starship/editor helpers.

- [ ] **Step 2: Add async Starship project reader**

Modify `extensions/lib/starship.ts` by adding imports and function:

```ts
import { execFile } from "node:child_process";
import { readdir } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const GIT_COMMAND_TIMEOUT_MS = 2_000;

export async function readStarshipProjectState(cwd: string): Promise<{ git?: StarshipGitStatus; runtime?: StarshipRuntime }> {
	const [entriesResult, gitResult, stashResult] = await Promise.allSettled([
		readdir(cwd),
		execFileAsync("git", ["status", "--porcelain=2", "--branch"], { cwd, timeout: GIT_COMMAND_TIMEOUT_MS }),
		execFileAsync("git", ["rev-parse", "--verify", "--quiet", "refs/stash"], { cwd, timeout: GIT_COMMAND_TIMEOUT_MS }),
	]);
	const entries = entriesResult.status === "fulfilled" ? entriesResult.value : [];
	const runtime = detectRuntimeFromEntries(entries, { nodeVersion: process.version });
	const git = gitResult.status === "fulfilled"
		? parseGitStatusPorcelain(String(gitResult.value.stdout ?? ""), stashResult.status === "fulfilled" && String(stashResult.value.stdout ?? "").trim().length > 0)
		: undefined;
	return { git, runtime };
}
```

- [ ] **Step 3: Modify `minimal.ts` imports**

In `extensions/minimal.ts`, remove limit footer imports:

```ts
import {
	renderLimitsContextLine,
	renderTitleContextLine,
	sanitizeTitle,
	SESSION_TITLE_ENTRY_TYPE,
	TITLE_STATE_EVENT,
	type TitleStatus,
} from "./lib/minimal-title.ts";
import { LIMITS_EVENT, displayModel, normalizeLimitDisplayModel, type LimitColorKind, type LimitDisplayModel } from "./lib/limit-usage.ts";
```

Replace with:

```ts
import {
	renderTitleContextLine,
	sanitizeTitle,
	SESSION_TITLE_ENTRY_TYPE,
	TITLE_STATE_EVENT,
	type TitleStatus,
} from "./lib/minimal-title.ts";
import {
	buildStarshipLine,
	readStarshipProjectState,
	type StarshipGitStatus,
	type StarshipRuntime,
} from "./lib/starship.ts";
import { createZentuiEditorFactory, formatProviderLabel, formatThinkingLabel } from "./lib/zentui-editor.ts";
```

Also delete the `renderLimitText()` function from `minimal.ts`.

- [ ] **Step 4: Add minimal-extra line helper**

Add after `formatDuration()` in `extensions/minimal.ts`:

```ts
function renderMinimalExtraLine(
	theme: Theme,
	width: number,
	status: TitleStatus,
	timerLabel: string,
	observedCaveman: ObservedCavemanState | null,
): string {
	const parts: string[] = [];
	if (status.state === "ready" && status.title) parts.push(theme.fg("accent", status.title));
	else if (status.state === "generating") parts.push(theme.fg("warning", `${status.frame ?? "⠋"} Generando título…`));
	else if (status.state === "error") parts.push(theme.fg("error", status.title ? `⚠ ${status.title} · /orgm-title regen` : "⚠ Error generando título · /orgm-title regen"));
	if (timerLabel) parts.push(theme.fg("borderAccent", timerLabel));
	if (observedCaveman) parts.push(theme.fg(observedCaveman.enabled ? "accent" : "text", formatObservedCavemanStatus(observedCaveman)));
	const line = parts.join(theme.fg("borderAccent", " · "));
	return truncateToWidth(line || theme.fg("text", ""), width);
}
```

- [ ] **Step 5: Replace minimal state and footer render logic**

In `extensions/minimal.ts`, remove:

```ts
let currentLimits: LimitDisplayModel = displayModel(undefined);
```

Add:

```ts
let starshipGit: StarshipGitStatus | undefined;
let starshipRuntime: StarshipRuntime | undefined;
```

Inside `installFooter()`, before `ctx.ui.setFooter`, install editor:

```ts
ctx.ui.setEditorComponent(createZentuiEditorFactory(() => ({
	modelLabel: ctx.model?.name || ctx.model?.id || "no-model",
	providerLabel: formatProviderLabel(typeof ctx.model?.provider === "string" ? ctx.model.provider : undefined),
	thinkingLabel: formatThinkingLabel(pi.getThinkingLevel()),
})));
```

In footer `render(width)`, replace old first-line/limits block with:

```ts
const usage = ctx.getContextUsage();
const contextWindow = ctx.model?.contextWindow ?? usage?.contextWindow;
const contextLabel = usage && contextWindow ? `${Math.round(usage.percent ?? 0)}%/${formatCompactNumber(contextWindow)}` : "--";

let inputTokens = 0;
let outputTokens = 0;
let cacheReadTokens = 0;
let cacheWriteTokens = 0;
let totalCost = 0;
for (const entry of ctx.sessionManager.getBranch()) {
	if (entry.type === "message" && entry.message.role === "assistant") {
		const message = entry.message as AssistantMessage;
		inputTokens += message.usage?.input ?? 0;
		outputTokens += message.usage?.output ?? 0;
		cacheReadTokens += message.usage?.cacheRead ?? 0;
		cacheWriteTokens += message.usage?.cacheWrite ?? 0;
		totalCost += message.usage?.cost?.total ?? 0;
	}
}
const tokenSummary = formatMinimalTokenSummary({
	input: inputTokens,
	output: outputTokens,
	cacheRead: cacheReadTokens,
	cacheWrite: cacheWriteTokens,
});
const firstLine = buildStarshipLine({
	cwd: ctx.cwd,
	git: starshipGit,
	runtime: starshipRuntime,
	extensionStatuses: footerData.getExtensionStatuses?.(),
	contextLabel,
	tokenLabel: tokenSummary,
	costLabel: formatCurrency(totalCost),
	width,
	style: (kind, text) => {
		if (kind === "cwd") return theme.fg("accent", text);
		if (kind === "git" || kind === "runtime") return theme.fg("text", text);
		if (kind === "gitStatus") return theme.fg("warning", text);
		if (kind === "context") return theme.fg("accent", text);
		if (kind === "cost") return theme.fg("warning", text);
		if (kind === "separator" || kind === "tokens" || kind === "status" || kind === "runtimePrefix") return theme.fg("borderAccent", text);
		return theme.fg("text", text);
	},
});
const lines = [
	firstLine,
	renderMinimalExtraLine(theme, width, titleStatus, timerLabel, observedCaveman),
];
```

Delete the old `renderTitleStatusLine(...)` call from the returned `lines` array and delete `renderLimitsContextLine(...)` spread.

- [ ] **Step 6: Refresh project state on session/model/git changes**

Inside `installFooter(ctx)`, after restoring state and before `ctx.ui.setFooter`, add:

```ts
void readStarshipProjectState(ctx.cwd).then((state) => {
	starshipGit = state.git;
	starshipRuntime = state.runtime;
	requestRender();
});
```

Change branch subscription to also refresh:

```ts
const unsubscribeBranch = footerData.onBranchChange(() => {
	void readStarshipProjectState(ctx.cwd).then((state) => {
		starshipGit = state.git;
		starshipRuntime = state.runtime;
		tui.requestRender();
	});
});
```

Remove the entire `pi.events.on(LIMITS_EVENT, ...)` block.

In `session_shutdown`, add editor cleanup:

```ts
currentCtx?.ui.setEditorComponent(undefined);
```

If no `currentCtx` variable exists in `minimal.ts`, add:

```ts
let activeCtx: ExtensionContext | undefined;
```

Set it in `installFooter(ctx)`:

```ts
activeCtx = ctx;
```

Use it in shutdown:

```ts
activeCtx?.ui.setEditorComponent(undefined);
activeCtx = undefined;
```

- [ ] **Step 7: Run minimal tests and verify GREEN**

Run:

```bash
node --experimental-strip-types tests/minimal-footer-utils.test.ts
node --experimental-strip-types tests/starship.test.ts
node --experimental-strip-types tests/zentui-editor.test.ts
```

Expected: no assertion errors. Node may print the existing `MODULE_TYPELESS_PACKAGE_JSON` warning.

- [ ] **Step 8: Commit minimal integration**

```bash
git add extensions/minimal.ts extensions/lib/starship.ts tests/minimal-footer-utils.test.ts
git commit -m "feat(minimal): use zentui starship layout"
```

---

### Task 4: Command-only Inline Limits

**Files:**
- Create: `tests/limit-inline.test.ts`
- Modify: `extensions/limit.ts`

- [ ] **Step 1: Write failing inline limit tests**

Create `tests/limit-inline.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderInlineLimitRows } from "../extensions/limit.ts";
import { displayModel, parseUsagePayload } from "../extensions/lib/limit-usage.ts";

const source = readFileSync(new URL("../extensions/limit.ts", import.meta.url), "utf8");
assert(source.includes("registerMessageRenderer"), "limit extension should register inline message renderer");
assert(source.includes("orgm-limits"), "limit extension should keep orgm-limits command");
assert(source.includes("pi.sendMessage"), "limit command should send inline display message");
assert(!source.includes("setInterval"), "limit extension should not auto-refresh with timer");
assert(!source.includes("session_start"), "limit extension should not refresh on session start");
assert(!source.includes("model_select"), "limit extension should not refresh on model select");
assert(!source.includes("ctx.ui.setStatus(\"orgm-limit"), "limit extension should not write persistent footer status");

const parsed = parseUsagePayload({
	rate_limit: {
		primary_window: { used_percent: 18, reset_at: 1780964760, limit_window_seconds: 18000 },
		secondary_window: { used_percent: 39, reset_at: 1781223960, limit_window_seconds: 604800 },
	},
});
const rows = renderInlineLimitRows(displayModel(parsed, false, undefined, new Date("2026-06-07T07:15:00Z")));
assert.equal(rows.length, 1, "inline limits should render one compact command-output row by default");
assert(rows[0]?.startsWith("ChatGPT limits · "), "inline limits should use ChatGPT limits prefix");
assert(rows[0]?.includes("C  5H"), "inline limits should use compact rows");

const missing = renderInlineLimitRows(displayModel(undefined, false, "missing-auth"));
assert.deepEqual(missing, ["ChatGPT limits · no auth"], "missing auth should render inline message");
```

- [ ] **Step 2: Run inline limit tests and verify RED**

Run:

```bash
node --experimental-strip-types tests/limit-inline.test.ts
```

Expected: FAIL because `renderInlineLimitRows` is not exported and `limit.ts` still has timer/session behavior.

- [ ] **Step 3: Rewrite `extensions/limit.ts` to command-only inline output**

Replace `extensions/limit.ts` with:

```ts
import { Text } from "@earendil-works/pi-tui";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { isOrgmExtensionEnabled } from "./lib/orgm-extension-config.ts";
import {
	MINIMAX_CN_USAGE_URL,
	displayModel,
	fetchMinimaxUsageSnapshot,
	fetchUsageSnapshot,
	noLimitsDisplayModel,
	providerLimitKind,
	readCodexAuth,
	readMinimaxApiKey,
	unsupportedLimitsDisplayModel,
	type LimitDisplayModel,
	type LimitSnapshot,
} from "./lib/limit-usage.ts";

const LIMITS_MESSAGE_TYPE = "orgm-limits";

export function renderInlineLimitRows(model: LimitDisplayModel): string[] {
	if (model.fullRows.some((row) => /missing-auth|auth/i.test(row)) || model.fullText.includes("missing-auth")) {
		return ["ChatGPT limits · no auth"];
	}
	const rows = model.compactRows.length > 0 ? model.compactRows : model.fullRows;
	if (rows.length === 0) return ["ChatGPT limits · no disponible"];
	return [`ChatGPT limits · ${rows.join(" · ")}`];
}

async function refreshOnce(ctx: ExtensionContext): Promise<LimitDisplayModel> {
	const kind = providerLimitKind(ctx.model);
	if (kind === "unsupported") {
		return unsupportedLimitsDisplayModel(typeof ctx.model?.provider === "string" ? ctx.model.provider : undefined);
	}
	if (kind === "minimax") {
		const apiKey = readMinimaxApiKey();
		if (!apiKey) return displayModel(undefined, false, "missing-auth");
		try {
			const url = ctx.model?.provider === "minimax-cn" ? MINIMAX_CN_USAGE_URL : undefined;
			const snapshot = await fetchMinimaxUsageSnapshot(apiKey, fetch, url);
			if (snapshot.planType === "unlimited") return noLimitsDisplayModel("minimax");
			return displayModel(snapshot, false);
		} catch {
			return displayModel(undefined, false, "fetch-failed");
		}
	}
	const auth = readCodexAuth();
	if (!auth) return displayModel(undefined, false, "missing-auth");
	try {
		const snapshot: LimitSnapshot = await fetchUsageSnapshot(auth);
		return displayModel(snapshot, false);
	} catch {
		return displayModel(undefined, false, "fetch-failed");
	}
}

export default function (pi: ExtensionAPI) {
	if (!isOrgmExtensionEnabled("limit")) return;

	pi.registerMessageRenderer(LIMITS_MESSAGE_TYPE, (message, _options, theme) => {
		const rows = Array.isArray(message.details?.rows) ? message.details.rows.map(String) : [String(message.content ?? "")];
		return new Text(rows.map((row) => theme.fg("accent", row)).join("\n"), 0, 0);
	});

	pi.registerCommand("orgm-limits", {
		description: "Show active provider usage limits inline",
		handler: async (_args, ctx) => {
			const model = await refreshOnce(ctx);
			const rows = renderInlineLimitRows(model);
			pi.sendMessage({
				customType: LIMITS_MESSAGE_TYPE,
				content: rows.join("\n"),
				display: true,
				details: { rows },
			});
		},
	});
}
```

- [ ] **Step 4: Run inline limit tests and verify GREEN**

Run:

```bash
node --experimental-strip-types tests/limit-inline.test.ts
node --experimental-strip-types tests/limit-usage.test.ts
```

Expected: no assertion errors. Node may print the existing `MODULE_TYPELESS_PACKAGE_JSON` warning.

- [ ] **Step 5: Commit inline limits**

```bash
git add extensions/limit.ts tests/limit-inline.test.ts
git commit -m "feat(limit): render limits inline on command"
```

---

### Task 5: Full Regression and Cleanup

**Files:**
- Modify if needed: `tests/*.test.ts`
- Modify if needed: `extensions/minimal.ts`, `extensions/limit.ts`, `extensions/lib/*.ts`

- [ ] **Step 1: Run focused changed tests**

Run:

```bash
node --experimental-strip-types tests/starship.test.ts
node --experimental-strip-types tests/zentui-editor.test.ts
node --experimental-strip-types tests/minimal-footer-utils.test.ts
node --experimental-strip-types tests/limit-inline.test.ts
node --experimental-strip-types tests/limit-usage.test.ts
```

Expected: no assertion errors.

- [ ] **Step 2: Run all tests**

Run:

```bash
for test in tests/*.test.ts; do
  echo "== $test =="
  node --experimental-strip-types "$test"
done
```

Expected: every test exits 0. Existing `MODULE_TYPELESS_PACKAGE_JSON` warnings are acceptable unless the project decides to add `"type": "module"` separately.

- [ ] **Step 3: Check git diff for forbidden behavior**

Run:

```bash
rg -n "LIMITS_EVENT|renderLimitsContextLine|currentLimits|setInterval|ctx\.ui\.setStatus\(\"orgm-limit|font\.ts|session_start" extensions/minimal.ts extensions/limit.ts extensions/lib tests || true
```

Expected:

```text
```

or only harmless matches outside `minimal.ts`/`limit.ts` tests that assert absence. There must be no `font.ts`, no persistent limit footer rendering in `minimal.ts`, and no auto-refresh timer/session hook in `limit.ts`.

- [ ] **Step 4: Check status**

Run:

```bash
git status --short
```

Expected: changed files are only intentional implementation/test files.

- [ ] **Step 5: Commit cleanup if any changes remain**

If Step 4 shows uncommitted changes, run:

```bash
git add extensions tests
git commit -m "test: verify minimal zentui visual"
```

Expected: commit succeeds or there are no changes to commit.

---

## Self-Review

- Spec coverage: covered editor chrome, Starship line, minimal-extra line, command-only inline limits, no font extension, and testing.
- Placeholder scan: no deferred or incomplete implementation notes.
- Type consistency: `StarshipGitStatus`, `StarshipRuntime`, `LimitDisplayModel`, and editor meta helper names are consistent across tasks.
