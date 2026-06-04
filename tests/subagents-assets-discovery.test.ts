import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("extensions/subagents.ts", "utf8");
assert.match(source, /findDeployableAgent\(runtimeCwd, params\.agent, scope\)/, "deploy_agent should resolve workers through assets/subagents discovery");
assert.doesNotMatch(source, /const agent = findAgent\(/, "deploy_agent must not call removed findAgent helper");
assert.match(source, /resolveConfiguredSubagentModel\(agent\.name, agentModels\) \?\? agent\.model/, "orgm.json model overrides should preserve frontmatter model fallback");
assert.doesNotMatch(source, /const builtinTools = params\.agent\.tools\.filter/, "deploy_agent should not drop extension/custom tools from the child allowlist");
assert.match(source, /args\.push\("--tools", params\.agent\.tools\.join\(","\)\)/, "deploy_agent should pass ask_user_question and Engram tools through --tools");
assert.match(source, /PI_SUBAGENT_DEPLOYMENT_ID/, "subagent children should be marked with a deployment id for diagnostics");
assert.match(source, /terminateSubagentProcessTree/, "subagent runner should terminate child process trees, not only direct children");
assert.match(source, /registerSubagentChildCleanup/, "subagent runner should register process-exit cleanup for active children");
