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
	{ ...base, lastResult: "planned" },
	{ ...base, agentId: "tdd-implementer", agentName: "tdd-implementer", state: "busy", activity: "editing failing tests", contextPercent: 55 },
	{ ...base, agentId: "tdd-verifier", agentName: "tdd-verifier", state: "dead", activity: "process exited", lastError: "exit 1" },
], 104, {
	color: false,
	showModel: true,
	showContext: true,
	showCompact: true,
	layout: "minimal",
});

assert(lines[0].includes("Full subagents"));
assert(lines.some((line) => line.includes("tdd-planner")));
assert(lines.some((line) => line.includes("done-idle")));
assert(lines.some((line) => line.includes("tdd-implementer")));
assert(lines.some((line) => line.includes("work")));
assert(lines.some((line) => line.includes("tdd-verifier")));
assert(lines.some((line) => line.includes("dead")));
assert(lines.some((line) => line.includes("[#---------] 10% C-1")));
assert(lines.some((line) => line.includes("[######----] 55% C-1")));
assert(lines.some((line) => line.includes(" | | ")), "wide minimal layout should place multiple agents on one row");
assert(lines.every((line) => line.length <= 104));

const fullLines = renderFullSubagentsWidgetLines([
	base,
	{ ...base, agentId: "tdd-await", agentName: "tdd-await", state: "awaiting_user", activity: "waiting permission" },
], 80, { color: false, showModel: true, showContext: true, showCompact: true, layout: "full" });
assert(fullLines.some((line) => line.includes("╭ tdd-planner")));
assert(fullLines.some((line) => line.includes("│ idle")));
assert(fullLines.some((line) => line.includes("│ await")));
assert(fullLines.some((line) => line.includes("anthropic/claude-sonnet-4-5")));
assert(fullLines.every((line) => line.length <= 80));

const narrow = renderFullSubagentsWidgetLines([
	{ ...base, agentName: "agent-with-a-very-long-name-that-must-truncate", activity: "activity with many words that must also truncate" },
], 32, { color: false, showModel: true, showContext: true, showCompact: true, layout: "minimal" });
assert(narrow.every((line) => line.length <= 32));
