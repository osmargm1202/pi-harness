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
assert.match(sddPrompt, /explicit user request|solicitud expl[ií]cita|solo.*solicit/i, "sdd mode should only allow fast_sdd by explicit user request");
assert.doesNotMatch(sddPrompt, /quick|narrow|reduced-context|contexto reducido/i, "sdd mode should not decide to use fast_sdd by scope");
assert.doesNotMatch(sddPrompt, /long|complex|high-context|largo|complej|mucho contexto/i, "sdd mode should not contrast fast_sdd with normal workers by scope");
assert.doesNotMatch(sddPrompt, /many fast agents|few fast agents/i, "sdd mode should not manage loops of fast agents");
assert.doesNotMatch(sddPrompt, /fast_sdd.*only.*(substantial|all)|all.*fast_sdd/i, "sdd mode should not force fast_sdd for all delegation");
assert.match(sddPrompt, /assets\/subagents\/sdd\//i, "sdd mode should still mention preferred SDD workers");
assert.match(sddPrompt, /any project subagent|any subagent|cualquier subagente/i, "sdd mode should allow broader subagent freedom");
assert.match(sddPrompt, /direct inline execution|ejecuci[oó]n directa|inline execution/i, "sdd mode should allow direct inline execution when useful");
assert.match(sddPrompt, /prefer|delegat|subagent/i, "sdd mode should still prefer delegation for substantial work");
assert.match(sddPrompt, /git push|git reset|migration|install|os\/network|sistema|red/i, "sdd mode should still call out high-risk operations");

const tddPrompt = readFileSync("agents/tdd.md", "utf8");
assert.match(tddPrompt, /fast_tdd/i, "tdd mode prompt should mention fast_tdd subagent");
assert.match(tddPrompt, /orchestrator/i, "tdd mode should identify itself as an orchestrator");
assert.match(tddPrompt, /90%|noventa/i, "tdd mode should delegate most substantial work");
assert.match(tddPrompt, /deploy_agent/i, "tdd mode should direct work through deploy_agent");
assert.match(tddPrompt, /explicit user request|solicitud expl[ií]cita|solo.*solicit/i, "tdd mode should only allow fast_tdd by explicit user request");
assert.doesNotMatch(tddPrompt, /quick|narrow|reduced-context|contexto reducido/i, "tdd mode should not decide to use fast_tdd by scope");
assert.doesNotMatch(tddPrompt, /long|complex|high-context|largo|complej|mucho contexto/i, "tdd mode should not contrast fast_tdd with normal workers by scope");
assert.doesNotMatch(tddPrompt, /many fast agents|few fast agents/i, "tdd mode should not manage loops of fast agents");
assert.doesNotMatch(tddPrompt, /fast_tdd.*only.*(substantial|all)|all.*fast_tdd/i, "tdd mode should not force fast_tdd for all delegation");
assert.match(tddPrompt, /assets\/subagents\/tdd\//i, "tdd mode should still mention preferred TDD workers");
assert.match(tddPrompt, /any project subagent|any subagent|cualquier subagente/i, "tdd mode should allow broader subagent freedom");
assert.match(tddPrompt, /direct inline execution|ejecuci[oó]n directa|inline execution/i, "tdd mode should allow direct inline execution when useful");
assert.match(tddPrompt, /prefer|delegat|subagent/i, "tdd mode should still prefer delegation for substantial work");
assert.match(tddPrompt, /git push|git reset|migration|install|os\/network|sistema|red/i, "tdd mode should still call out high-risk operations");
assert.match(tddPrompt, /always.*deploy_agent|siempre.*deploy_agent|must.*deploy_agent|prefer.*deploy_agent|prefer.*subagent/i, "tdd mode should strongly steer substantial work through deploy_agent");
assert.match(sddPrompt, /always.*deploy_agent|siempre.*deploy_agent|must.*deploy_agent|prefer.*deploy_agent|prefer.*subagent/i, "sdd mode should strongly steer substantial work through deploy_agent");

assert.match(planPrompt, /plan first|plan primero|first produce/i, "plan mode should require a concrete plan before switching modes");
assert.match(planPrompt, /before.*switch|antes.*cambiar|antes.*pedir/i, "plan mode should not ask for a mode switch before producing a plan");
