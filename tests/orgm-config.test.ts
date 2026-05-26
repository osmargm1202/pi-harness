import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadAgentStatusConfig } from "../extensions/lib/agent-status-config.ts";
import { loadCavemanConfig } from "../extensions/lib/caveman-state.ts";
import { loadOrgmConfig, saveOrgmConfigSlice } from "../extensions/lib/orgm-config.ts";
import { loadMinimalSkillsConfig } from "../extensions/minimal.ts";

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

	assert.equal(
		loadCavemanConfig(configPath).defaultLevel,
		"lite",
		"caveman.defaultLevel should load from central orgm.json",
	);

	assert.equal(
		loadMinimalSkillsConfig(configPath).enabled,
		false,
		"minimalSkills.enabled should load from central orgm.json",
	);

	assert.equal(
		loadAgentStatusConfig(configPath).showWidget,
		false,
		"agentStatus.showWidget should load from central orgm.json",
	);
	saveOrgmConfigSlice("defaultPrimaryAgent", "pi", configPath);
	saveOrgmConfigSlice("title", { autoGenerate: true }, configPath);
	const savedConfig = loadOrgmConfig(configPath);
	assert.equal(savedConfig.defaultPrimaryAgent, "pi", "defaultPrimaryAgent should persist through saveOrgmConfigSlice");
	assert.equal(savedConfig.title.autoGenerate, true, "title config should persist through saveOrgmConfigSlice");
} finally {
	rmSync(tempDir, { recursive: true, force: true });
}
