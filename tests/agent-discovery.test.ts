import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { discoverDeployableAgents, discoverPrimaryAgents } from "../extensions/lib/agent-discovery.ts";

const packageAgents = discoverDeployableAgents(tmpdir(), "user");
const skillExpert = packageAgents.find((agent) => agent.name === "skill-expert");
assert(skillExpert, "package-bundled deployable agents should be discovered without ~/.pi/agent/agents");
assert.equal(skillExpert.source, "user");
assert(skillExpert.filePath.endsWith("/agents/pi-orchestrator/skill-expert.md"));

const primaryAgents = discoverPrimaryAgents(tmpdir(), "user");
assert(primaryAgents.some((agent) => agent.name === "pi-orchestrator"), "package-bundled primary agents should be discovered");
const piOrchestrator = primaryAgents.find((agent) => agent.name === "pi-orchestrator");
assert.deepEqual(
	piOrchestrator?.routing?.avoid_when,
	["Generic application backend, frontend, mobile, data, infrastructure, security, or product work that is not about Pi itself"],
	"pi-orchestrator primary profile should warn auto routing away from generic app work",
);
assert(piOrchestrator?.routing?.subagents?.includes("coding-expert"), "pi-orchestrator routing profile should include subagent names");

for (const agent of primaryAgents) {
	assert(agent.routing?.strict_use_for?.length, `${agent.name} primary profile should declare strict_use_for`);
	assert(agent.routing?.best_for?.length, `${agent.name} primary profile should declare best_for`);
	assert(agent.routing?.avoid_when?.length, `${agent.name} primary profile should declare avoid_when`);
	assert(agent.routing?.keywords?.length, `${agent.name} primary profile should declare keywords`);
	assert(agent.routing?.subagents?.length, `${agent.name} primary profile should declare subagent names`);
}

{
	const routingRoot = mkdtempSync(join(tmpdir(), "pi-harness-routing-profile-"));
	const routingAgentsDir = join(routingRoot, ".pi", "agents", "custom-primary");
	mkdirSync(routingAgentsDir, { recursive: true });
	writeFileSync(join(routingAgentsDir, "helper-one.md"), `---\nname: helper-one\ndescription: helper\n---\nHelper body\n`);
	writeFileSync(
		join(routingAgentsDir, "index.md"),
		`---\nname: custom-primary\ndescription: Custom primary\nrouting:\n  strict_use_for:\n    - Custom strict task\n  best_for:\n    - Custom best task\n  avoid_when:\n    - Custom avoid task\n  keywords:\n    - custom-keyword\n---\nCustom body\n`,
	);
	const customPrimary = discoverPrimaryAgents(routingRoot, "both").find((agent) => agent.name === "custom-primary");
	assert.deepEqual(customPrimary?.routing, {
		strict_use_for: ["Custom strict task"],
		best_for: ["Custom best task"],
		avoid_when: ["Custom avoid task"],
		keywords: ["custom-keyword"],
		subagents: ["helper-one"],
	}, "primary discovery should parse routing frontmatter and derive subagent names");
}

const projectRoot = mkdtempSync(join(tmpdir(), "pi-harness-agent-project-"));
const projectAgentsDir = join(projectRoot, ".pi", "agents");
mkdirSync(projectAgentsDir, { recursive: true });
writeFileSync(
	join(projectAgentsDir, "skill-expert.md"),
	`---\nname: skill-expert\ndescription: project override\ntools: read\nmodel: openai-codex/gpt-5.5\n---\nProject override body\n`,
);

const mergedAgents = discoverDeployableAgents(projectRoot, "both");
const overridden = mergedAgents.find((agent) => agent.name === "skill-expert");
assert(overridden, "merged discovery should include the project override");
assert.equal(overridden.source, "project");
assert.equal(overridden.description, "project override");
assert.equal(overridden.model, undefined, "agent frontmatter model should be ignored so default/main model is used unless orgm.json overrides it");
assert.equal(overridden.systemPrompt, "Project override body");
