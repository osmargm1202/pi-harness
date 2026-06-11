import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AGENT_STATUS_CONFIG_DEFAULTS } from "../extensions/lib/agent-status-config.ts";
import { shouldShowAgentStatusWidget } from "../extensions/agent-status.ts";

const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, contextTokens: 0, turns: 0 };
const runningDeployment = {
	deploymentId: "tdd-implementer#4",
	agent: "tdd-implementer",
	source: "user" as const,
	tools: [],
	mode: "ephemeral" as const,
	launchBackend: "embedded" as const,
	contextWindow: 272000,
	contextTokens: 56000,
	status: "running" as const,
	summary: "queued",
	currentActivity: "thinking...",
	turns: 10,
	usage,
	pddMemoryWrites: 0,
	attemptedModels: [],
	fallbackUsed: false,
};

assert.equal(
	shouldShowAgentStatusWidget([runningDeployment], [], AGENT_STATUS_CONFIG_DEFAULTS, null),
	false,
	"a single active deploy_agent should not also render the subagent widget",
);

assert.equal(
	shouldShowAgentStatusWidget([runningDeployment, { ...runningDeployment, deploymentId: "reviewer#1", agent: "reviewer" }], [], AGENT_STATUS_CONFIG_DEFAULTS, null),
	true,
	"multiple active deployments should still render the coordination widget",
);

assert.equal(
	shouldShowAgentStatusWidget([], [], AGENT_STATUS_CONFIG_DEFAULTS, null),
	false,
	"empty state should not render the widget",
);

const agentStatusSource = readFileSync(new URL("../extensions/agent-status.ts", import.meta.url), "utf8");
const agentStatusConfigSource = readFileSync(new URL("../extensions/lib/agent-status-config.ts", import.meta.url), "utf8");
assert(!("showCaveman" in AGENT_STATUS_CONFIG_DEFAULTS), "agent-status defaults should not expose showCaveman");
for (const forbidden of [
	"caveman-state",
	"CAVEMAN_STATE_EVENT",
	"formatCavemanStatus",
	"resolveInitialCavemanState",
	"CavemanLevel",
	"showCaveman",
	"caveman:",
]) {
	assert(!agentStatusSource.includes(forbidden), `agent-status should not contain caveman term ${forbidden}`);
	assert(!agentStatusConfigSource.includes(forbidden), `agent-status config should not contain caveman term ${forbidden}`);
}

assert.match(agentStatusSource, /matchesKey\(data, Key\.escape\)/, "agent status transcript viewer should close on normalized Escape key events");
assert.match(agentStatusSource, /matchesKey\(data, Key\.ctrl\("c"\)\)/, "agent status transcript viewer should also close on Ctrl+C");
