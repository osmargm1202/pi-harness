import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mergeFullSubagentsConfig } from "../extensions/lib/full-subagents-config.ts";
import { syncFullSubagentOverrides, validateFullSubagentBackings } from "../extensions/lib/full-subagents-agent-sync.ts";

const tempDir = mkdtempSync(join(tmpdir(), "full-subagents-agent-sync-"));
try {
	const cwd = join(tempDir, "project");
	const projectAgentsDir = join(cwd, ".pi", "agents", "sdd-orchestrator");
	const userAgentsDir = join(tempDir, "home", ".pi", "agent", "agents");
	mkdirSync(projectAgentsDir, { recursive: true });

	writeFileSync(
		join(projectAgentsDir, "tdd-planner.md"),
		`---\nname: tdd-planner\ndescription: Planner\nmodel: openai-codex/gpt-5.3-codex-spark\ntools: read, bash\n---\n\nPlanner body\n`,
		"utf8",
	);

	const config = mergeFullSubagentsConfig({
		agents: {
			"tdd-planner": {
				model: "openai-codex/gpt-5.4",
				tools: ["read"],
				skills: "none",
				mcp: "all",
				extensions: "inherit",
			},
			missing: { model: "openai-codex/gpt-5.4" },
		},
	});

	const backing = validateFullSubagentBackings(config, { cwd, userAgentsDir });
	assert(backing.backed.includes("tdd-planner"));
	assert.deepEqual(backing.missing, ["missing"]);

	const report = syncFullSubagentOverrides(config, { cwd, userAgentsDir });
	assert.deepEqual(report.synced, ["tdd-planner"]);
	assert.deepEqual(report.missing, ["missing"]);

	const syncedPath = join(userAgentsDir, "sdd-orchestrator", "tdd-planner.md");
	const synced = readFileSync(syncedPath, "utf8");
	assert.match(synced, /^model: openai-codex\/gpt-5\.4$/m);
	assert.match(synced, /^tools: read$/m);
	assert.match(synced, /^skills: none$/m);
	assert.match(synced, /^mcp: all$/m);
	assert.doesNotMatch(synced, /^extensions:/m, "inherit values should not be persisted as overrides");
	assert.match(synced, /Planner body/);

	writeFileSync(
		syncedPath,
		synced.replace("model: openai-codex/gpt-5.4", "model: stale/model"),
		"utf8",
	);
	const secondReport = syncFullSubagentOverrides(config, { cwd, userAgentsDir });
	assert.deepEqual(secondReport.updated, ["tdd-planner"]);
	assert.match(readFileSync(syncedPath, "utf8"), /^model: openai-codex\/gpt-5\.4$/m);
} finally {
	rmSync(tempDir, { recursive: true, force: true });
}
