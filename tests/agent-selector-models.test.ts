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
