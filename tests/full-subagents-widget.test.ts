import assert from "node:assert/strict";
import { renderFullSubagentsWidgetLines } from "../extensions/lib/full-subagents-widget.ts";
import type { FullSubagentSnapshot } from "../extensions/lib/full-subagents-com.ts";

const base: FullSubagentSnapshot = {
	agentId: "tdd-planner",
	agentName: "tdd-planner",
	model: "anthropic/claude-sonnet-4-5",
	state: "idle",
	activity: "idle",
	contextTokens: 1000,
	contextWindow: 10000,
	contextPercent: 10,
	compactCount: 1,
};

const lines = renderFullSubagentsWidgetLines([
	base,
	{ ...base, agentId: "tdd-implementer", agentName: "tdd-implementer", state: "busy", activity: "editing failing tests", contextPercent: 55 },
	{ ...base, agentId: "tdd-verifier", agentName: "tdd-verifier", state: "dead", activity: "process exited", lastError: "exit 1" },
], 80, {
	color: false,
	showModel: true,
	showContext: true,
	showCompact: true,
});

assert(lines[0].includes("Full subagents"));
assert(lines.some((line) => line.includes("tdd-planner")));
assert(lines.some((line) => line.includes("idle")));
assert(lines.some((line) => line.includes("tdd-implementer")));
assert(lines.some((line) => line.includes("busy")));
assert(lines.some((line) => line.includes("tdd-verifier")));
assert(lines.some((line) => line.includes("dead")));
assert(lines.some((line) => line.includes("ctx 55%")));
assert(lines.some((line) => line.includes("compact 1")));
assert(lines.every((line) => line.length <= 80));

const narrow = renderFullSubagentsWidgetLines([
	{ ...base, agentName: "agent-with-a-very-long-name-that-must-truncate", activity: "activity with many words that must also truncate" },
], 32, { color: false, showModel: true, showContext: true, showCompact: true });
assert(narrow.every((line) => line.length <= 32));
