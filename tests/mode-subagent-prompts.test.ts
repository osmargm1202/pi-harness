import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

assert(existsSync("assets/subagents/plan/planner.md"), "plan mode should have planner subagent");
assert(existsSync("assets/subagents/ask/investigator.md"), "ask mode should have investigator subagent");
assert(existsSync("assets/subagents/build/builder.md"), "build mode should have builder subagent");
assert(existsSync("assets/subagents/build/fast_builder.md"), "build mode should have fast_builder subagent");

const fastBuilder = readFileSync("assets/subagents/build/fast_builder.md", "utf8");
assert.match(fastBuilder, /^model:\s*openai-codex\/gpt-5\.3-codex-spark$/m, "fast_builder should declare spark model");
assert.match(fastBuilder, /aplicaciones rápidas|rapid applications/i, "fast_builder should document rapid app scope");
assert.match(fastBuilder, /contexto reducido|reduced context/i, "fast_builder should document reduced context scope");

const planPrompt = readFileSync("agents/plan.md", "utf8");
assert.match(planPrompt, /planner/i, "plan mode prompt should mention planner subagent");

const askPrompt = readFileSync("agents/ask.md", "utf8");
assert.match(askPrompt, /investigator/i, "ask mode prompt should mention investigator subagent");

const buildPrompt = readFileSync("agents/build.md", "utf8");
assert.match(buildPrompt, /builder/i, "build mode prompt should mention builder subagent");
assert.match(buildPrompt, /fast_builder/i, "build mode prompt should mention fast_builder subagent");
