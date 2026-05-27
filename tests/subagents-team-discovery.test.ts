import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { discoverTeams } from "../extensions/subagents.ts";

const packageTeams = discoverTeams(tmpdir(), "user");
const piOrchestrator = packageTeams.find((team) => team.name === "pi-orchestrator");
assert(piOrchestrator, "package-bundled teams.yaml should be discovered without ~/.pi/agent/agents");
assert.equal(piOrchestrator.source, "user");
assert(piOrchestrator.filePath.endsWith("/agents/teams.yaml"));
assert(piOrchestrator.members.includes("skill-expert"), "package pi-orchestrator should include skill-expert");

const coreDevelopment = packageTeams.find((team) => team.name === "01-core-development");
assert(coreDevelopment, "package-bundled VoltAgent core development team should be discovered");
assert.equal(coreDevelopment.source, "user");
assert(coreDevelopment.members.includes("backend-developer"), "core development team should include backend-developer");

const researchAnalysis = packageTeams.find((team) => team.name === "10-research-analysis");
assert(researchAnalysis, "package-bundled VoltAgent research analysis team should be discovered");
assert(researchAnalysis.members.includes("research-analyst"), "research analysis team should include research-analyst");

const projectRoot = mkdtempSync(join(tmpdir(), "pi-harness-team-project-"));
const projectAgentsDir = join(projectRoot, ".pi", "agents");
mkdirSync(projectAgentsDir, { recursive: true });
writeFileSync(
	join(projectAgentsDir, "teams.yaml"),
	`pi-orchestrator:\n  - project-only\n`,
);

const mergedTeams = discoverTeams(projectRoot, "both");
const overridden = mergedTeams.find((team) => team.name === "pi-orchestrator");
assert(overridden, "merged discovery should include project team override");
assert.equal(overridden.source, "project");
assert.deepEqual(overridden.members, ["project-only"]);
