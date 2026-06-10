import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initializeOrgmConfig, loadOrgmConfig, loadOrgmConfigSlice, saveOrgmConfigSlice } from "../extensions/lib/orgm-config.ts";

const tempDir = mkdtempSync(join(tmpdir(), "orgm-config-"));
const configPath = join(tempDir, "orgm.json");

writeFileSync(configPath, JSON.stringify({
	unknownFutureKey: { keep: true },
	mode: { defaultMode: "build", allowedModes: ["pi", "plan", "build", "ask", "sdd", "tdd", "debug"] },
	title: { autoGenerate: false },
}, null, 2), "utf8");

const orgmConfig = loadOrgmConfig(configPath);
assert.deepEqual(orgmConfig.mode, {
	defaultMode: "build",
	allowedModes: ["pi", "plan", "build", "ask", "sdd", "tdd", "debug"],
});
assert.deepEqual((orgmConfig as any).unknownFutureKey, { keep: true });
assert.equal(orgmConfig.title.autoGenerate, false);
assert.equal((orgmConfig as any).defaultPrimaryAgent, undefined, "primary agent config should be removed");
assert.equal((orgmConfig as any).primaryAuto, undefined, "primary auto config should be removed");
assert.equal((orgmConfig as any).repoTree, undefined, "repo tree config should be removed");
assert.equal((orgmConfig as any).flows, undefined, "flow config should be removed");

assert.equal(loadOrgmConfigSlice("mode", configPath).defaultMode, "build");
saveOrgmConfigSlice("mode", { defaultMode: "ask", allowedModes: ["pi", "plan", "build", "ask", "sdd", "tdd"] }, configPath);
const savedConfig = JSON.parse(readFileSync(configPath, "utf8"));
assert.deepEqual(savedConfig.mode, { defaultMode: "ask", allowedModes: ["pi", "plan", "build", "ask", "sdd", "tdd"] });
assert.deepEqual(savedConfig.unknownFutureKey, { keep: true });

const initialized = initializeOrgmConfig(join(tempDir, "fresh.json"));
assert.deepEqual(initialized.mode, { defaultMode: "pi", allowedModes: ["pi", "plan", "build", "ask", "sdd", "tdd"] });
