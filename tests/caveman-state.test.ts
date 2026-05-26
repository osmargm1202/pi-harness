import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { getDefaultCavemanSkillPath, normalizeCavemanLevel, readCavemanSkillBody } from "../extensions/lib/caveman-state.ts";

const skillPath = getDefaultCavemanSkillPath();
assert(
	skillPath.includes("pi-harness") && skillPath.endsWith("skills/caveman/SKILL.md"),
	"default caveman skill path should resolve bundled package skill before missing user path",
);
assert(existsSync(skillPath), "default caveman skill path should exist");

const result = readCavemanSkillBody(skillPath, "lite");
assert.equal(result.error, undefined);
assert(result.body?.includes("Selected level: lite"), "caveman lite body should load from resolved skill");
assert(result.body?.includes("Auto-Clarity"), "caveman body should preserve auto-clarity rules");

assert.equal(normalizeCavemanLevel("wenyan"), "wenyan-full", "wenyan should alias to wenyan-full");
const wenyan = readCavemanSkillBody(skillPath, "wenyan-full");
assert.equal(wenyan.error, undefined);
assert(wenyan.body?.includes("Selected level: wenyan-full"), "wenyan-full body should load from resolved skill");
