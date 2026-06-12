import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	PI_CAVEMAN_STATE_EVENT,
	PI_CAVEMAN_STATE_KEY,
	formatObservedCavemanStatus,
	normalizeObservedCavemanState,
} from "../extensions/lib/caveman-state.ts";

const packageRoot = process.cwd();

assert.equal(PI_CAVEMAN_STATE_KEY, "pi-caveman:state", "observer entry key should match pi-caveman contract");
assert.equal(PI_CAVEMAN_STATE_EVENT, "pi-caveman:state", "observer event should match pi-caveman contract");

assert(!existsSync(join(packageRoot, "extensions", "caveman.ts")), "pi-harness should not ship caveman runtime extension");
assert(!existsSync(join(packageRoot, "skills", "caveman", "SKILL.md")), "pi-harness should not ship caveman prompt skill");

const validEnabled = normalizeObservedCavemanState({
	schemaVersion: 1,
	packageName: "pi-caveman",
	enabled: true,
	level: "full",
	defaultLevel: "full",
	autoEnable: true,
	source: "startup",
	updatedAt: Date.now(),
});
assert(validEnabled, "valid pi-caveman state should normalize");
assert.equal(formatObservedCavemanStatus(validEnabled), "caveman:full");

const validDisabled = normalizeObservedCavemanState({
	schemaVersion: 1,
	packageName: "pi-caveman",
	enabled: false,
	level: null,
	defaultLevel: "full",
	autoEnable: false,
	source: "command",
	updatedAt: Date.now(),
});
assert(validDisabled, "valid disabled state should normalize");
assert.equal(formatObservedCavemanStatus(validDisabled), "caveman:off");

assert.equal(normalizeObservedCavemanState({ schemaVersion: 1, packageName: "other", enabled: true, level: "full" }), null);
assert.equal(normalizeObservedCavemanState({ schemaVersion: 1, packageName: "pi-caveman", enabled: true, level: "invalid" }), null);
assert.equal(normalizeObservedCavemanState({ schemaVersion: 2, packageName: "pi-caveman", enabled: true, level: "full" }), null);

const helperSource = readFileSync(join(packageRoot, "extensions", "lib", "caveman-state.ts"), "utf8");
for (const forbidden of [
	"loadCavemanConfig",
	"saveCavemanConfig",
	"resolveInitialCavemanState",
	"readCavemanSkillBody",
	"findInstalledSkillPath",
	"getAgentDir",
	"orgm-config",
	"package-paths",
	"caveman-level",
	"caveman:state-changed",
	"skills/caveman/SKILL.md",
]) {
	assert(!helperSource.includes(forbidden), `observer helper should not contain runtime term ${forbidden}`);
}
