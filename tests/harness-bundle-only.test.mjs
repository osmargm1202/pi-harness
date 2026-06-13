import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("pi-harness is bundle-only for ORGM banner/git runtime", () => {
	const pkg = JSON.parse(readFileSync("package.json", "utf8"));
	assert(!existsSync("extensions/orgm.ts"), "orgm header/control plane belongs to pi-banner");
	assert(!existsSync("extensions/git.ts"), "git automation should not be a pi-harness runtime extension");
	assert(!existsSync("prompts"), "workflow prompts should not live in pi-harness");
	assert(!pkg.pi.extensions.includes("./extensions"), "pi-harness should not load local runtime extensions");
	assert(!pkg.pi.prompts.includes("./prompts"), "pi-harness should not load local prompts");
	assert(!pkg.files.includes("prompts"), "pi-harness package should not publish local prompts");
	assert(pkg.pi.extensions.includes("node_modules/pi-banner/extensions"), "pi-harness should load pi-banner");
	assert(pkg.pi.prompts.includes("node_modules/pi-subagents/agents"), "pi-harness should load subagent prompts");
});
