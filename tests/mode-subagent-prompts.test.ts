import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

assert(existsSync("assets/subagents/plan/planner.md"), "plan mode should have planner subagent");
assert(existsSync("assets/subagents/plan/fast_planner.md"), "plan mode should have fast_planner subagent");
assert(existsSync("assets/subagents/ask/investigator.md"), "ask mode should have investigator subagent");
assert(existsSync("assets/subagents/ask/fast_investigator.md"), "ask mode should have fast_investigator subagent");
assert(existsSync("assets/subagents/build/builder.md"), "build mode should have builder subagent");
assert(existsSync("assets/subagents/build/fast_builder.md"), "build mode should have fast_builder subagent");
assert(existsSync("assets/subagents/sdd/fast_sdd.md"), "sdd mode should have fast_sdd subagent");
assert(existsSync("assets/subagents/tdd/fast_tdd.md"), "tdd mode should have fast_tdd subagent");

const fastSubagents = [
	["fast_builder", "assets/subagents/build/fast_builder.md"],
	["fast_planner", "assets/subagents/plan/fast_planner.md"],
	["fast_investigator", "assets/subagents/ask/fast_investigator.md"],
	["fast_sdd", "assets/subagents/sdd/fast_sdd.md"],
	["fast_tdd", "assets/subagents/tdd/fast_tdd.md"],
] as const;
for (const [name, path] of fastSubagents) {
	const content = readFileSync(path, "utf8");
	assert.match(content, /^model:\s*openai-codex\/gpt-5\.3-codex-spark$/m, `${name} should declare spark model`);
	assert.match(content, /contexto reducido|reduced context/i, `${name} should document reduced context scope`);
	assert.match(content, /tareas largas|long tasks|mucho contexto|large context/i, `${name} should warn against long or high-context tasks`);
}

const planPrompt = readFileSync("agents/plan.md", "utf8");
assert.match(planPrompt, /planner/i, "plan mode prompt should mention planner subagent");
assert.match(planPrompt, /fast_planner/i, "plan mode prompt should mention fast_planner subagent");

const askPrompt = readFileSync("agents/ask.md", "utf8");
assert.match(askPrompt, /investigator/i, "ask mode prompt should mention investigator subagent");
assert.match(askPrompt, /fast_investigator/i, "ask mode prompt should mention fast_investigator subagent");

const buildPrompt = readFileSync("agents/build.md", "utf8");
assert.match(buildPrompt, /builder/i, "build mode prompt should mention builder subagent");
assert.match(buildPrompt, /fast_builder/i, "build mode prompt should mention fast_builder subagent");

const sddPrompt = readFileSync("agents/sdd.md", "utf8");
assert.match(sddPrompt, /fast_sdd/i, "sdd mode prompt should mention fast_sdd subagent");

const tddPrompt = readFileSync("agents/tdd.md", "utf8");
assert.match(tddPrompt, /fast_tdd/i, "tdd mode prompt should mention fast_tdd subagent");
