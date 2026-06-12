import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

assert(!existsSync("extensions/mode.ts"), "mode extension should be disabled by renaming extensions/mode.ts away from .ts");
assert(existsSync("extensions/mode.ts.disabled"), "disabled mode source should be archived beside extensions as mode.ts.disabled");
assert(!existsSync("skills"), "package should not bundle local skills; pi-footer owns skills instead");
assert(!existsSync("assets/subagents"), "package should not expose bundled subagents by default");

const manifest = JSON.parse(readFileSync("package.json", "utf8"));
assert(!manifest.files?.includes("skills"), "package files should not include local skills");
assert(!manifest.files?.includes("agents"), "package files should not include mode prompt agents");
assert(!manifest.files?.includes("archive"), "package files should not include removed archive directory");
assert(!manifest.files?.includes("lib"), "package files should not include missing lib directory");
assert.deepEqual(manifest.pi?.skills, ["node_modules/pi-footer/skills"], "pi manifest should delegate skills to pi-footer");
assert(!JSON.stringify(manifest.pi ?? {}).includes("mode"), "pi manifest should not explicitly expose mode extension");
