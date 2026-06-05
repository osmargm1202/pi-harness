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
assert.match(sddPrompt, /orchestrator/i, "sdd mode should identify itself as an orchestrator");
assert.match(sddPrompt, /90%|noventa/i, "sdd mode should delegate most substantial work");
assert.match(sddPrompt, /deploy_agent/i, "sdd mode should direct work through deploy_agent");
assert.match(sddPrompt, /quick|narrow|reduced-context|contexto reducido/i, "sdd mode should describe fast_sdd scope");
assert.match(sddPrompt, /long|complex|high-context|largo|complej|mucho contexto/i, "sdd mode should choose normal workers for large work");
assert.match(sddPrompt, /many fast agents|loops|loop|few fast agents/i, "sdd mode should avoid loops of many fast agents");
assert.doesNotMatch(sddPrompt, /fast_sdd.*only.*(substantial|all)|all.*fast_sdd/i, "sdd mode should not force fast_sdd for all delegation");
assert.match(sddPrompt, /assets\/subagents\/sdd\//i, "sdd mode should allow dedicated SDD workers for larger work");
assert.match(sddPrompt, /inline.*lecturas|inline.*quick reads|lecturas.*rápidas/i, "sdd mode should limit inline work to quick reads");
assert.match(sddPrompt, /prohibid|forbidden|do not attempt/i, "sdd mode should explicitly say forbidden inline actions must not be attempted");
assert.match(sddPrompt, /rm|mkdir|pnpm|docker|ssh|git push|git reset/i, "sdd mode should name common blocked command classes");

const tddPrompt = readFileSync("agents/tdd.md", "utf8");
assert.match(tddPrompt, /fast_tdd/i, "tdd mode prompt should mention fast_tdd subagent");
assert.match(tddPrompt, /orchestrator/i, "tdd mode should identify itself as an orchestrator");
assert.match(tddPrompt, /90%|noventa/i, "tdd mode should delegate most substantial work");
assert.match(tddPrompt, /deploy_agent/i, "tdd mode should direct work through deploy_agent");
assert.match(tddPrompt, /quick|narrow|reduced-context|contexto reducido/i, "tdd mode should describe fast_tdd scope");
assert.match(tddPrompt, /long|complex|high-context|largo|complej|mucho contexto/i, "tdd mode should choose normal workers for large work");
assert.match(tddPrompt, /many fast agents|loops|loop|few fast agents/i, "tdd mode should avoid loops of many fast agents");
assert.doesNotMatch(tddPrompt, /fast_tdd.*only.*(substantial|all)|all.*fast_tdd/i, "tdd mode should not force fast_tdd for all delegation");
assert.match(tddPrompt, /assets\/subagents\/tdd\//i, "tdd mode should allow normal TDD workers for larger work");
assert.match(tddPrompt, /inline.*lecturas|inline.*quick reads|lecturas.*rápidas/i, "tdd mode should limit inline work to quick reads");
assert.match(tddPrompt, /prohibid|forbidden|do not attempt/i, "tdd mode should explicitly say forbidden inline actions must not be attempted");
assert.match(tddPrompt, /rm|mkdir|pnpm|docker|ssh|git push|git reset/i, "tdd mode should name common blocked command classes");
assert.match(tddPrompt, /always.*deploy_agent|siempre.*deploy_agent|must.*deploy_agent/i, "tdd mode should require deploy_agent for substantial work");
assert.match(sddPrompt, /always.*deploy_agent|siempre.*deploy_agent|must.*deploy_agent/i, "sdd mode should require deploy_agent for substantial work");

assert.match(planPrompt, /plan first|plan primero|first produce/i, "plan mode should require a concrete plan before switching modes");
assert.match(planPrompt, /before.*switch|antes.*cambiar|antes.*pedir/i, "plan mode should not ask for a mode switch before producing a plan");
