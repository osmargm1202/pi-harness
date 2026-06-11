import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

assert(!existsSync("extensions/mode.ts"), "mode extension should not exist as loadable TypeScript");
assert(existsSync("extensions/mode.ts.disabled"), "mode implementation should be kept as disabled archive file");

const minimalSource = readFileSync("extensions/minimal.ts", "utf8");
assert(!minimalSource.includes("from \"./mode.ts\""), "minimal footer should not import disabled mode extension");
assert(!minimalSource.includes("MODE_STATE_EVENT"), "minimal footer should not listen for disabled mode changes");
