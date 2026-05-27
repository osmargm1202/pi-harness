import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
	findInstalledSkillPath,
	getCurrentPackageAgentsDir,
	getCurrentPackageRoot,
} from "../extensions/lib/package-paths.ts";

const packageRoot = getCurrentPackageRoot();
assert(existsSync(`${packageRoot}/package.json`), "package root should contain package.json");

const agentsDir = getCurrentPackageAgentsDir();
assert(agentsDir, "current package agents dir should resolve");
assert(agentsDir.endsWith("/agents"), "agents dir should be the package agents directory");
assert(existsSync(`${agentsDir}/teams.yaml`), "agents dir should contain teams.yaml");

const packageSkill = join(packageRoot, "skills", "caveman", "SKILL.md");
assert(existsSync(packageSkill), "current package should bundle caveman skill");

const manifest = JSON.parse(await import("node:fs/promises").then((fs) => fs.readFile(join(packageRoot, "package.json"), "utf8")));
assert(manifest.files.includes("skills"), "package files should include bundled skills");
assert(manifest.pi.skills.includes("./skills"), "pi manifest should expose bundled skills");

const cavemanSkill = findInstalledSkillPath("caveman");
assert.equal(cavemanSkill, packageSkill, "current package skill should be preferred over external installs");
assert(existsSync(cavemanSkill), "resolved caveman skill should exist");
