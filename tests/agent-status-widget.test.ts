import assert from "node:assert/strict";
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
