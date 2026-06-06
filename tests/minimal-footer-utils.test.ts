import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderSkillChipRows } from "../extensions/lib/minimal-skill.ts";
import { visibleWidth } from "../extensions/lib/minimal-title.ts";
import { formatMinimalModeLabel } from "../extensions/minimal.ts";

const style = (_kind: string, text: string) => text;
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
assert(!minimalSource.includes('theme.fg("muted"'), "minimal footer should avoid muted theme token because light themes can render it too pale");
assert(!minimalSource.includes('theme.fg("dim"'), "minimal footer should avoid dim theme token because light themes can render it too pale");

assert.equal(formatMinimalModeLabel("plan"), "PLAN", "minimal footer should render active mode label");
assert.equal(formatMinimalModeLabel("tdd"), "TDD", "minimal footer should render TDD mode label");
assert(minimalSource.includes("MODE_STATE_EVENT"), "minimal footer should listen for mode changes");
assert(!minimalSource.includes('let currentPrimary = "pi"'), "minimal footer should not hard-code pi as the footer mode label");
assert(!minimalSource.includes("const centerRaw = folderLabel;"), "primary minimal footer line should not duplicate the folder shown in the title context row");
assert(!minimalSource.includes("const agentStatus = timerLabel ? `${modeLabel} · ${timerLabel}` : modeLabel;"), "primary minimal footer line should not duplicate the mode shown in the title context row");
assert(!minimalSource.includes('if (titleStatus.state !== "idle" || titleStatus.title)'), "title context row should render from session start before title generation");
