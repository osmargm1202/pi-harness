import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadAgentStatusConfig } from "../extensions/lib/agent-status-config.ts";
import { loadCavemanConfig } from "../extensions/lib/caveman-state.ts";
import { loadOrgmConfig } from "../extensions/lib/orgm-config.ts";
import { loadMinimalSkillsConfig } from "../extensions/minimal.ts";

const tempDir = mkdtempSync(join(tmpdir(), "orgm-config-"));
const configPath = join(tempDir, "orgm.json");

try {
	writeFileSync(configPath, JSON.stringify({
		repoTree: { maxDepth: 5 },
		caveman: { defaultLevel: "lite" },
		minimalSkills: { enabled: false },
		agentStatus: { showWidget: false },
	}, null, 2), "utf8");

	const orgmConfig = loadOrgmConfig(configPath);
	assert.equal(orgmConfig.repoTree.maxDepth, 5, "repoTree.maxDepth should load from central orgm.json");

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
} finally {
	rmSync(tempDir, { recursive: true, force: true });
}
