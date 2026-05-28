import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { collectConfiguredAgentModels } from "../extensions/agent-selector.ts";

const ctx = {
	cwd: process.cwd(),
	modelRegistry: {
		getAvailable() {
			return [{ provider: "test-provider", id: "base-model" }];
		},
	},
};

const configPath = join(mkdtempSync(join(tmpdir(), "agent-selector-models-")), "orgm.json");
writeFileSync(configPath, JSON.stringify({
	agentModels: {
		"coding-expert": "orgm-provider/coding-model",
		"empty-agent": "   ",
	},
}, null, 2), "utf8");

const models = collectConfiguredAgentModels(ctx as any, undefined, configPath);
assert(models.includes("test-provider/base-model"), "model selector should include registry models");
assert(models.includes("orgm-provider/coding-model"), "model selector should include per-agent model overrides from orgm.json");
assert(!models.includes("openai-codex/gpt-5.5"), "model selector should not include package agent frontmatter models");
assert(!models.includes("openai-codex/gpt-5.4"), "model selector should not include package agent frontmatter models");
assert(
	!models.includes("openai-codex/gpt-5.3-codex-spark"),
	"Codex Spark agents should no longer advertise 5.3-codex-spark",
);
