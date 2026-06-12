import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("pi-harness is bundle-only for ORGM banner/git runtime", () => {
	const pkg = JSON.parse(readFileSync("package.json", "utf8"));
	assert(!existsSync("extensions/orgm.ts"), "orgm header/control plane belongs to pi-banner");
	assert(!existsSync("extensions/git.ts"), "git automation should not be a pi-harness runtime extension");
	assert(!pkg.pi.extensions.includes("./extensions"), "pi-harness should not load local runtime extensions");
	assert(pkg.pi.extensions.includes("node_modules/pi-banner/extensions"), "pi-harness should load pi-banner");
});
