import assert from "node:assert/strict";
import { buildRepoIndexSystemPrompt } from "../extensions/repo-index.ts";

const basePrompt = "base system prompt";
const context = "# Repo Context\n\n- Project: demo\n";

const first = buildRepoIndexSystemPrompt(basePrompt, context);
assert(first.includes(basePrompt), "base system prompt should be preserved");
assert(first.includes(context), "repo context should be appended");
assert(first.includes("At session/subagent start"), "prompt should describe lifecycle scope");
assert(first.includes("update .pi-cache/repo-index.json"), "prompt should instruct agents to update persistent repo knowledge when relevant");
assert(first.includes("persistent.summary"), "prompt should mention summary fields agents can improve");

const second = buildRepoIndexSystemPrompt(first, context);
assert.equal(second, first, "repo context injection should be idempotent and not append twice");
