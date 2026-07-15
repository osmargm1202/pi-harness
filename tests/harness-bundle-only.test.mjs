import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("pi-harness is bundle-only for ORGM banner/git runtime", () => {
	let pkg;
	try {
		const pkgRaw = readFileSync("package.json", "utf8");
		pkg = JSON.parse(pkgRaw);
	} catch (err) {
		assert.fail(`Failed to read/parse package.json: ${String(err)}`);
	}
	assert(
		!existsSync("extensions/orgm.ts"),
		"orgm header/control plane belongs to pi-banner",
	);
	assert(
		!existsSync("extensions/git.ts"),
		"git automation should not be a pi-harness runtime extension",
	);
	assert(
		!existsSync("prompts"),
		"workflow prompts should not live in pi-harness",
	);
	assert(
		!pkg.pi.extensions.includes("./extensions"),
		"pi-harness should not load local runtime extensions",
	);
	assert(
		!Object.hasOwn(pkg.pi, "prompts"),
		"pi-harness should not load prompts",
	);
	assert(
		!pkg.files.includes("prompts"),
		"pi-harness package should not publish local prompts",
	);
	assert(
		pkg.pi.extensions.includes("node_modules/pi-banner/extensions"),
		"pi-harness should load pi-banner",
	);
	assert(
		pkg.pi.extensions.includes("node_modules/pi-subagents-j0k3r/index.ts"),
		"pi-harness should load subagent delegation runtime",
	);
	assert(
		pkg.pi.extensions.includes("node_modules/pi-lens/dist/index.js"),
		"pi-harness should load pi-lens",
	);
	assert(
		pkg.pi.extensions.includes("node_modules/@juicesharp/rpiv-todo/index.ts"),
		"pi-harness should load rpiv todo",
	);
});
