import assert from "node:assert/strict";
import { getDeployAgentInlineRuntimeParts, getDeployAgentInlineStatusText } from "../extensions/subagents.ts";

const details = {
	deploymentId: "tdd-implementer#6",
	agent: "tdd-implementer",
	instanceNumber: 6,
	source: "user" as const,
	tools: [],
	mode: "ephemeral" as const,
	launchBackend: "embedded" as const,
	reusedRuntime: false,
	depth: 1,
	contextWindow: 272000,
	status: "running" as const,
	summary: "thinking",
	usage: { input: 35000, output: 1000, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 33000, turns: 7 },
	exitCode: 0,
};

const statusText = getDeployAgentInlineStatusText(details);
assert.equal(statusText.includes("tdd-implementer"), false, "inline status should not repeat agent name already shown in deploy_agent title");
assert.equal(statusText.includes("#6"), true, "inline status should keep the deployment instance identifier");

const runtimeParts = getDeployAgentInlineRuntimeParts(details);
assert.equal(runtimeParts.includes("mode: ephemeral"), false, "inline runtime metadata should not repeat mode already shown in deploy_agent title");
assert.deepEqual(runtimeParts, ["new", "depth: 1"]);
