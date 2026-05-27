import assert from "node:assert/strict";
import { collectConfiguredAgentModels } from "../extensions/agent-selector.ts";

const ctx = {
	cwd: process.cwd(),
	modelRegistry: {
		getAvailable() {
			return [{ provider: "test-provider", id: "base-model" }];
		},
	},
};

const models = collectConfiguredAgentModels(ctx as any);
assert(models.includes("test-provider/base-model"), "model selector should include registry models");
assert(
	models.includes("openai-codex/gpt-5.5"),
	"model selector should include model frontmatter from package-bundled agents",
);
assert(
	models.includes("openai-codex/gpt-5.4"),
	"model selector should include the configured Codex 5.4 model from package-bundled agents",
);
assert(
	!models.includes("openai-codex/gpt-5.3-codex-spark"),
	"Codex Spark agents should no longer advertise 5.3-codex-spark",
);
