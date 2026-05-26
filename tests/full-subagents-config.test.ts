import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	DEFAULT_FULL_SUBAGENTS_CONFIG,
	loadFullSubagentsConfig,
	mergeFullSubagentsConfig,
} from "../extensions/lib/full-subagents-config.ts";
import { loadOrgmConfig } from "../extensions/lib/orgm-config.ts";

assert.equal(DEFAULT_FULL_SUBAGENTS_CONFIG.enabled, false);
assert.equal(DEFAULT_FULL_SUBAGENTS_CONFIG.strictDelegation, true);
assert.equal(DEFAULT_FULL_SUBAGENTS_CONFIG.maxAgents, 5);
assert.equal(DEFAULT_FULL_SUBAGENTS_CONFIG.startupTeam, "tdd-core");
assert.deepEqual(DEFAULT_FULL_SUBAGENTS_CONFIG.teams["tdd-core"], [
	"tdd-brainstormer",
	"tdd-planner",
	"tdd-implementer",
	"tdd-reviewer",
	"tdd-verifier",
]);

const merged = mergeFullSubagentsConfig({
	enabled: true,
	strictDelegation: false,
	maxAgents: 99,
	startupTeam: "custom",
	teams: { custom: ["alpha", "", "beta", "alpha"] },
	agents: {
		alpha: {
			model: "anthropic/claude-sonnet-4-5",
			tools: ["read", "bash"],
			skills: "all",
			mcp: "inherit",
			extensions: "none",
		},
	},
});
assert.equal(merged.enabled, true);
assert.equal(merged.strictDelegation, false);
assert.equal(merged.maxAgents, 10);
assert.equal(merged.startupTeam, "custom");
assert.deepEqual(merged.teams.custom, ["alpha", "beta"]);
assert.deepEqual(merged.agents.alpha.tools, ["read", "bash"]);
assert.equal(merged.agents.alpha.skills, "all");
assert.equal(merged.agents.alpha.mcp, "inherit");
assert.equal(merged.agents.alpha.extensions, "none");

const tempDir = mkdtempSync(join(tmpdir(), "full-subagents-config-"));
const configPath = join(tempDir, "orgm.json");
try {
	writeFileSync(
		configPath,
		JSON.stringify(
			{
				fullSubagents: {
					enabled: true,
					maxAgents: 0,
					startupTeam: "solo",
					teams: { solo: ["tdd-verifier"] },
				},
			},
			null,
			2,
		),
		"utf8",
	);
	const fromLoader = loadFullSubagentsConfig(configPath);
	assert.equal(fromLoader.enabled, true);
	assert.equal(fromLoader.maxAgents, 1);
	assert.deepEqual(fromLoader.teams.solo, ["tdd-verifier"]);

	const orgm = loadOrgmConfig(configPath);
	assert.equal(orgm.fullSubagents.enabled, true);
	assert.equal(orgm.fullSubagents.maxAgents, 1);
	assert.equal(orgm.fullSubagents.startupTeam, "solo");
} finally {
	rmSync(tempDir, { recursive: true, force: true });
}
