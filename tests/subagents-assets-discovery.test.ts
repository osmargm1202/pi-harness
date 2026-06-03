import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("extensions/subagents.ts", "utf8");
assert.match(source, /findDeployableAgent\(runtimeCwd, params\.agent, scope\)/, "deploy_agent should resolve workers through assets/subagents discovery");
assert.doesNotMatch(source, /const agent = findAgent\(/, "deploy_agent must not call removed findAgent helper");
assert.match(source, /resolveConfiguredSubagentModel\(agent\.name, agentModels\) \?\? agent\.model/, "orgm.json model overrides should preserve frontmatter model fallback");
