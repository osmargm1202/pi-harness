import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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
assert(agentsDir, "source checkout can still resolve archived mode prompt files for tests/docs");
assert(agentsDir.endsWith("/agents"), "agents dir should be the source agents directory when present");
assert(!existsSync(`${agentsDir}/teams.yaml`), "agents dir should not contain teams.yaml");

const subagentsDir = getCurrentPackageAssetsSubagentsDir();
assert.equal(subagentsDir, null, "package assets/subagents should not resolve after archiving bundled subagents");
assert(existsSync(join(packageRoot, "archive", "subagents", "tdd", "tdd-planner.md")), "archived subagents should remain in source tree");

const manifest = JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8"));
assert(!manifest.files.includes("skills"), "package files should not include bundled skills");
assert(!manifest.files.includes("agents"), "package files should not include mode prompt agents");
assert(!manifest.pi.skills, "pi manifest should not expose bundled skills");
assert(!JSON.stringify(manifest.pi).includes("extensions/caveman.ts"), "pi manifest should not expose harness caveman extension");

const packagePathsSource = readFileSync(join(packageRoot, "extensions", "lib", "package-paths.ts"), "utf8");
assert(!packagePathsSource.includes("caveman"), "package path helpers should not contain caveman-specific runtime preference");
assert.equal(findInstalledSkillPath("__pi_harness_missing_skill__"), null, "generic missing skill lookup should stay safe");
