import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { discoverDeployableAgents, discoverPrimaryAgents } from "../extensions/lib/agent-discovery.ts";

const packageAgents = discoverDeployableAgents(tmpdir(), "user");
const skillExpert = packageAgents.find((agent) => agent.name === "skill-expert");
assert(skillExpert, "package-bundled deployable agents should be discovered without ~/.pi/agent/agents");
assert.equal(skillExpert.source, "user");
assert(skillExpert.filePath.includes("pi-harness/agents/pi-orchestrator/skill-expert.md"));

const primaryAgents = discoverPrimaryAgents(tmpdir(), "user");
assert(primaryAgents.some((agent) => agent.name === "pi-orchestrator"), "package-bundled primary agents should be discovered");

const projectRoot = mkdtempSync(join(tmpdir(), "pi-harness-agent-project-"));
const projectAgentsDir = join(projectRoot, ".pi", "agents");
mkdirSync(projectAgentsDir, { recursive: true });
writeFileSync(
	join(projectAgentsDir, "skill-expert.md"),
	`---\nname: skill-expert\ndescription: project override\ntools: read\n---\nProject override body\n`,
);

const mergedAgents = discoverDeployableAgents(projectRoot, "both");
const overridden = mergedAgents.find((agent) => agent.name === "skill-expert");
assert(overridden, "merged discovery should include the project override");
assert.equal(overridden.source, "project");
assert.equal(overridden.description, "project override");
assert.equal(overridden.systemPrompt, "Project override body");
