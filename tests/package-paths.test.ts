import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

assert(existsSync("package.json"), "package root should contain package.json");
assert(!existsSync("agents/teams.yaml"), "agents dir should not contain teams.yaml");
assert(!existsSync("assets/subagents"), "package assets/subagents should not resolve after splitting subagents");

const manifest = JSON.parse(readFileSync("package.json", "utf8"));
assert(!manifest.files.includes("skills"), "package files should not include local bundled skills");
assert(!manifest.files.includes("agents"), "package files should not include mode prompt agents");
assert(!manifest.pi.skills, "pi manifest should not expose bundled skills");
assert(!JSON.stringify(manifest.pi).includes("extensions/caveman.ts"), "pi manifest should not expose harness caveman extension");
assert(JSON.stringify(manifest.pi).includes("node_modules/pi-subagents/extensions"), "pi manifest should delegate subagents to pi-subagents");
