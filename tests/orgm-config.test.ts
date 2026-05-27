import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadAgentStatusConfig } from "../extensions/lib/agent-status-config.ts";
import { loadOrgmConfig, loadOrgmConfigSlice, saveOrgmConfigSlice, type OrgmHostConfig } from "../extensions/lib/orgm-config.ts";

const tempDir = mkdtempSync(join(tmpdir(), "orgm-config-"));
const configPath = join(tempDir, "orgm.json");

try {
	writeFileSync(configPath, JSON.stringify({
		defaultPrimaryAgent: "pi-orchestrator",
		repoTree: { enabled: false, maxDepth: 5 },
		title: { autoGenerate: false },
		caveman: { defaultLevel: "lite" },
		minimalSkills: { enabled: false },
		agentStatus: { showWidget: false },
	}, null, 2), "utf8");

	const orgmConfig = loadOrgmConfig(configPath);
	assert.equal(orgmConfig.defaultPrimaryAgent, "pi-orchestrator", "defaultPrimaryAgent should load from central orgm.json");
	assert.equal(orgmConfig.repoTree.enabled, false, "repoTree.enabled should load from central orgm.json");
	assert.equal(orgmConfig.repoTree.maxDepth, 5, "repoTree.maxDepth should load from central orgm.json");
	assert.equal(orgmConfig.title.autoGenerate, false, "title.autoGenerate should load from central orgm.json");
	assert.equal(loadOrgmConfigSlice("title", configPath).autoGenerate, false, "loadOrgmConfigSlice should load title slice");
	assert.equal(loadOrgmConfigSlice("agentStatus", configPath).showWidget, false, "loadOrgmConfigSlice should load agentStatus slice");

	assert.equal(loadOrgmConfigSlice("caveman", configPath).defaultLevel, "lite", "caveman slice should load from central orgm.json");
	assert.equal(loadOrgmConfigSlice("minimalSkills", configPath).enabled, false, "minimalSkills slice should load from central orgm.json");
	assert.equal(loadOrgmConfigSlice("agentStatus", configPath).showWidget, false, "agentStatus slice should load from central orgm.json");
	assert.equal(loadAgentStatusConfig(configPath).showWidget, false, "agentStatus wrapper should load through central slice helper");
	saveOrgmConfigSlice("defaultPrimaryAgent", "pi", configPath);
	saveOrgmConfigSlice("title", { autoGenerate: true }, configPath);
	const savedConfig = loadOrgmConfig(configPath);
	assert.equal(savedConfig.defaultPrimaryAgent, "pi", "defaultPrimaryAgent should persist through saveOrgmConfigSlice");
	assert.equal(savedConfig.title.autoGenerate, true, "title config should persist through saveOrgmConfigSlice");

	writeFileSync(configPath, JSON.stringify({
		unknownFutureKey: { keep: true },
		fullSubagents: { legacyPilot: true, startupTeam: "legacy" },
		title: { autoGenerate: false },
	}, null, 2), "utf8");
	saveOrgmConfigSlice("title", { autoGenerate: true }, configPath);
	const rawSaved = JSON.parse(readFileSync(configPath, "utf8"));
	assert.deepEqual(rawSaved.unknownFutureKey, { keep: true }, "saveOrgmConfigSlice should preserve unknown top-level keys");
	assert.equal(rawSaved.title.autoGenerate, true, "saveOrgmConfigSlice should write the requested slice");

	const preserved = loadOrgmConfig(configPath) as OrgmHostConfig & { [key: string]: unknown };
	assert.deepEqual(
		preserved.unknownFutureKey,
		{ keep: true },
		"loadOrgmConfig should keep unknown future keys to avoid config key loss",
	);
	assert.deepEqual(
		preserved.fullSubagents,
		{ legacyPilot: true, startupTeam: "legacy" },
		"loadOrgmConfig should preserve fullSubagents as unknown local config key",
	);
} finally {
	rmSync(tempDir, { recursive: true, force: true });
}
