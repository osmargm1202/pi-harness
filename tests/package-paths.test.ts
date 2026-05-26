import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import {
	findInstalledSkillPath,
	getCurrentPackageAgentsDir,
	getCurrentPackageRoot,
} from "../extensions/lib/package-paths.ts";

const packageRoot = getCurrentPackageRoot();
assert(packageRoot.endsWith("pi-harness"), "current package root should be pi-harness");
assert(existsSync(`${packageRoot}/package.json`), "package root should contain package.json");

const agentsDir = getCurrentPackageAgentsDir();
assert(agentsDir, "current package agents dir should resolve");
assert(agentsDir.endsWith("pi-harness/agents"), "agents dir should be inside pi-harness");
assert(existsSync(`${agentsDir}/teams.yaml`), "agents dir should contain teams.yaml");

const cavemanSkill = findInstalledSkillPath("caveman");
assert(cavemanSkill, "installed package skill path should resolve caveman");
assert(cavemanSkill.endsWith("skills/caveman/SKILL.md"), "caveman path should point to SKILL.md");
assert(existsSync(cavemanSkill), "resolved caveman skill should exist");
