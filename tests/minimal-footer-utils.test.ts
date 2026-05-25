import assert from "node:assert/strict";
import { renderSkillChipRows } from "../extensions/lib/minimal-skill.ts";
import { visibleWidth } from "../extensions/lib/minimal-title.ts";

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
