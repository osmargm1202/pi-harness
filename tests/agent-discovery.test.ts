import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { discoverDeployableAgents, findDeployableAgent } from "../extensions/lib/agent-discovery.ts";

const packageAgents = discoverDeployableAgents(tmpdir(), "user");
const tddPlanner = packageAgents.find((agent) => agent.name === "tdd-planner");
assert(tddPlanner, "package-bundled assets/subagents should be discovered without ~/.pi/agent/agents");
assert.equal(tddPlanner.source, "user");
assert(tddPlanner.filePath.endsWith("/assets/subagents/tdd/tdd-planner.md"));
assert(!packageAgents.some((agent) => agent.name === "skill-expert"), "old pi-orchestrator agents should not be deployable");

const planner = packageAgents.find((agent) => agent.name === "planner");
assert(planner, "plan/planner subagent should be discoverable");
assert(planner.filePath.endsWith("/assets/subagents/plan/planner.md"));

const investigator = packageAgents.find((agent) => agent.name === "investigator");
assert(investigator, "ask/investigator subagent should be discoverable");
assert(investigator.filePath.endsWith("/assets/subagents/ask/investigator.md"));

const builder = packageAgents.find((agent) => agent.name === "builder");
assert(builder, "build/builder subagent should be discoverable");
assert(builder.filePath.endsWith("/assets/subagents/build/builder.md"));

const fastBuilder = packageAgents.find((agent) => agent.name === "fast_builder");
assert(fastBuilder, "build/fast_builder subagent should be discoverable");
assert(fastBuilder.filePath.endsWith("/assets/subagents/build/fast_builder.md"));
assert.equal(fastBuilder.model, "openai-codex/gpt-5.3-codex-spark", "fast_builder should request the spark model from frontmatter");

for (const [name, suffix] of [
	["fast_planner", "/assets/subagents/plan/fast_planner.md"],
	["fast_investigator", "/assets/subagents/ask/fast_investigator.md"],
	["fast_sdd", "/assets/subagents/sdd/fast_sdd.md"],
	["fast_tdd", "/assets/subagents/tdd/fast_tdd.md"],
] as const) {
	const agent = packageAgents.find((candidate) => candidate.name === name);
	assert(agent, `${name} subagent should be discoverable`);
	assert(agent.filePath.endsWith(suffix), `${name} path should be ${suffix}`);
	assert.equal(agent.model, "openai-codex/gpt-5.3-codex-spark", `${name} should request the spark model from frontmatter`);
}

const projectRoot = mkdtempSync(join(tmpdir(), "pi-harness-agent-project-"));
const projectSubagentsDir = join(projectRoot, ".pi", "assets", "subagents", "tdd");
mkdirSync(projectSubagentsDir, { recursive: true });
writeFileSync(
	join(projectSubagentsDir, "tdd-planner.md"),
	`---\nname: tdd-planner\ndescription: project override\ntools: read\nmodel: openai-codex/gpt-5.5\n---\nProject override body\n`,
);

const mergedAgents = discoverDeployableAgents(projectRoot, "both");
const overridden = mergedAgents.find((agent) => agent.name === "tdd-planner");
assert(overridden, "merged discovery should include project asset subagent override");
assert.equal(overridden.source, "project");
assert.equal(overridden.description, "project override");
assert.equal(overridden.model, "openai-codex/gpt-5.5", "agent frontmatter model should be preserved unless orgm.json overrides it");
assert.equal(overridden.systemPrompt, "Project override body");

assert.equal(findDeployableAgent(projectRoot, "tdd-planner", "both")?.source, "project");
