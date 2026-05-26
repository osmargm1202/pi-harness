import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { getDefaultCavemanSkillPath, readCavemanSkillBody } from "../extensions/lib/caveman-state.ts";

const skillPath = getDefaultCavemanSkillPath();
assert(
	skillPath.includes("pi-skills") && skillPath.endsWith("skills/caveman/SKILL.md"),
	"default caveman skill path should resolve installed pi-skills package before missing user path",
);
assert(existsSync(skillPath), "default caveman skill path should exist");

const result = readCavemanSkillBody(skillPath, "lite");
assert.equal(result.error, undefined);
assert(result.body?.includes("Selected level: lite"), "caveman lite body should load from resolved skill");
