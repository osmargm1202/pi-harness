import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderSkillChipRows } from "../extensions/lib/minimal-skill.ts";
import { visibleWidth } from "../extensions/lib/minimal-title.ts";
import { formatObservedCavemanStatus, normalizeObservedCavemanState } from "../extensions/lib/caveman-state.ts";
import { formatMinimalModeLabel, formatMinimalTokenSummary } from "../extensions/minimal.ts";

const style = (_kind: string, text: string) => text;
const markedStyle = (kind: string, text: string) => `<${kind}>${text}</${kind}>`;
const skills = new Map([
	["brainstorming", "loaded" as const],
	["test-driven-development", "loaded" as const],
	["writing-plans", "loading" as const],
	["verification-before-completion", "error" as const],
]);

const wideRows = renderSkillChipRows(skills, 120, style);
assert.equal(wideRows.length, 1, "wide footer should keep all skill chips on one row");
assert(wideRows[0]?.includes("▏brainstorming▕"), "loaded skill should render as compact chip");
assert(wideRows[0]?.includes("writing-plans…"), "loading skill should include ellipsis marker");
assert(wideRows[0]?.includes("verification-before-completion!"), "error skill should include error marker");
assert(wideRows.every((row) => visibleWidth(row) <= 120), "wide rows must fit width");

const narrowRows = renderSkillChipRows(skills, 36, style);
assert(narrowRows.length > 1, "narrow footer should wrap chips across rows");
assert(narrowRows.every((row) => visibleWidth(row) <= 36), "narrow rows must fit width");
assert(narrowRows.join(" ").includes("test-driven-development"), "wrapped rows should preserve skill names");

const tinyRows = renderSkillChipRows(new Map([["very-long-skill-name-that-cannot-fit", "loaded" as const]]), 12, style);
assert.equal(tinyRows.length, 1, "single oversized skill should still render one row");
assert(visibleWidth(tinyRows[0] ?? "") <= 12, "oversized skill chip should truncate to width");

const minimalSource = readFileSync(new URL("../extensions/minimal.ts", import.meta.url), "utf8");
assert(!minimalSource.includes("theme.fg(\"muted\""), "minimal footer should avoid muted theme token because light themes can render it too pale");
assert(!minimalSource.includes("theme.fg(\"dim\""), "minimal footer should avoid dim theme token because light themes can render it too pale");

assert.equal(formatMinimalModeLabel("pi"), "PI", "minimal footer should render default Pi mode label");
assert.equal(formatMinimalModeLabel("plan"), "PLAN", "minimal footer should render active mode label");
assert.equal(formatMinimalModeLabel("tdd"), "TDD", "minimal footer should render TDD mode label");
assert.equal(
	formatMinimalTokenSummary({ input: 1000, output: 250, cacheRead: 3000, cacheWrite: 1000 }),
	"↑1.0k ↓250 R3.0k W1.0k CH60.0%",
	"minimal footer should show cache read/write totals and latest prompt cache hit rate",
);
assert.equal(
	formatMinimalTokenSummary({ input: 1000, output: 250, cacheRead: 0, cacheWrite: 0 }),
	"↑1.0k ↓250",
	"minimal footer should omit cache hit rate when no cache tokens are present",
);
assert(!minimalSource.includes("MODE_STATE_EVENT"), "minimal footer should not listen for disabled mode changes");
assert(!minimalSource.includes("let currentPrimary = \"pi\""), "minimal footer should not hard-code pi as the footer mode label");
assert(!minimalSource.includes("const centerRaw = folderLabel;"), "primary minimal footer line should not duplicate the folder shown in the title context row");
assert(!minimalSource.includes("const agentStatus = timerLabel ? `${modeLabel} · ${timerLabel}` : modeLabel;"), "primary minimal footer line should not duplicate the mode shown in the title context row");
assert(!minimalSource.includes("if (titleStatus.state !== \"idle\" || titleStatus.title)"), "title context row should render from session start before title generation");
assert(!minimalSource.includes("LIMITS_EVENT"), "minimal footer should not listen for command-only limits event");
assert(!minimalSource.includes("renderLimitsContextLine"), "minimal footer should not render persistent limit rows");
assert(!minimalSource.includes("currentLimits"), "minimal footer should not keep persistent limit display model");
assert(minimalSource.includes("buildStarshipLine"), "minimal footer should render Starship line");
assert(minimalSource.includes("readStarshipProjectState"), "minimal footer should refresh project git/runtime state");
assert(minimalSource.includes("createZentuiEditorFactory"), "minimal extension should install Zentui-style editor");
assert(minimalSource.includes("ctx.ui.setEditorComponent"), "minimal extension should set editor component");
assert(minimalSource.includes("renderMinimalExtraLine"), "minimal extension should render title/timer/caveman on separate line");
assert(minimalSource.includes("PI_CAVEMAN_STATE_EVENT"), "minimal footer should observe pi-caveman shared event");
assert(minimalSource.includes("PI_CAVEMAN_STATE_KEY"), "minimal footer should inspect pi-caveman shared session entry");
assert(minimalSource.includes("normalizeObservedCavemanState"), "minimal footer should validate observed caveman payloads");
for (const forbidden of [
	"loadCavemanConfig",
	"resolveInitialCavemanState",
	"saveCavemanConfig",
	"caveman-level",
	"caveman:state-changed",
	"ctx.sessionManager.appendEntry(PI_CAVEMAN_STATE_KEY",
	"pi.events.emit(PI_CAVEMAN_STATE_EVENT",
]) {
	assert(!minimalSource.includes(forbidden), `minimal footer should not own caveman runtime term ${forbidden}`);
}
assert(!minimalSource.includes("showCavemanStatus"), "minimal footer should not load harness caveman visibility config");
assert(!minimalSource.includes("caveman:off") || minimalSource.includes("observedCaveman"), "minimal footer should show caveman:off only after valid observed state");
const observedEnabled = normalizeObservedCavemanState({
	schemaVersion: 1,
	packageName: "pi-caveman",
	enabled: true,
	level: "full",
	defaultLevel: "full",
	autoEnable: true,
	source: "startup",
	updatedAt: Date.now(),
});
assert(observedEnabled, "valid observed caveman payload should normalize");
assert.equal(formatObservedCavemanStatus(observedEnabled), "caveman:full", "valid enabled state should render caveman level");
assert.equal(normalizeObservedCavemanState(undefined), null, "missing observed state should stay silent/no UI");
assert.equal(normalizeObservedCavemanState({ enabled: true, level: "full" }), null, "invalid observed state should stay silent/no UI");
