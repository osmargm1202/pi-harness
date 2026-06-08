import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
	findInstalledSkillPath,
	getCurrentPackageAgentsDir,
	getCurrentPackageAssetsSubagentsDir,
	getCurrentPackageRoot,
	getPiDocsDir,
	getPiExamplesDir,
} from "../extensions/lib/package-paths.ts";

const packageRoot = getCurrentPackageRoot();
assert(existsSync(`${packageRoot}/package.json`), "package root should contain package.json");

const piDocsDir = getPiDocsDir();
assert(existsSync(`${piDocsDir}/extensions.md`), "Pi docs helper should resolve installed Pi extension docs through public SDK exports");
const piExamplesDir = getPiExamplesDir();
assert(existsSync(`${piExamplesDir}/extensions/project-trust.ts`), "Pi examples helper should resolve installed Pi extension examples through public SDK exports");

const agentsDir = getCurrentPackageAgentsDir();
assert(agentsDir, "current package agents dir should resolve");
assert(agentsDir.endsWith("/agents"), "agents dir should be the package agents directory");
assert(!existsSync(`${agentsDir}/teams.yaml`), "agents dir should not contain teams.yaml");
assert(existsSync(`${agentsDir}/plan.md`), "agents dir should contain plan mode prompt");
assert(existsSync(`${agentsDir}/build.md`), "agents dir should contain build mode prompt");
assert(existsSync(`${agentsDir}/ask.md`), "agents dir should contain ask mode prompt");

const subagentsDir = getCurrentPackageAssetsSubagentsDir();
assert(subagentsDir, "assets/subagents dir should resolve");
assert(subagentsDir.endsWith("/assets/subagents"), "subagents dir should be assets/subagents");
assert(existsSync(`${subagentsDir}/tdd/tdd-planner.md`), "assets subagents should contain TDD workers under tdd/");
assert(existsSync(`${subagentsDir}/sdd/sdd-apply.md`), "assets subagents should contain SDD workers under sdd/");

const packageSkill = join(packageRoot, "skills", "caveman", "SKILL.md");
assert(existsSync(packageSkill), "current package should bundle caveman skill");

const manifest = JSON.parse(await import("node:fs/promises").then((fs) => fs.readFile(join(packageRoot, "package.json"), "utf8")));
assert(manifest.files.includes("skills"), "package files should include bundled skills");
assert(manifest.pi.skills.includes("./skills"), "pi manifest should expose bundled skills");

const cavemanSkill = findInstalledSkillPath("caveman");
assert.equal(cavemanSkill, packageSkill, "current package skill should be preferred over external installs");
assert(existsSync(cavemanSkill), "resolved caveman skill should exist");
