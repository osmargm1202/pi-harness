import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildProjectTreeText, isSafeProjectRoot, resolveTreeRoot } from "../extensions/lib/repo-tree.ts";

const fakeHome = "/home/user";

assert.equal(
	isSafeProjectRoot("/home/user/Code/project", fakeHome),
	true,
	"safe roots should allow projects below a home project directory",
);

for (const unsafeRoot of ["/home/user", "/", "/usr", "/etc", "/var", "/tmp/project", "/home/other/Code/project", "/home/user/Downloads/project"]) {
	assert.equal(isSafeProjectRoot(unsafeRoot, fakeHome), false, `${unsafeRoot} should not be a safe project root`);
}

assert.equal(
	resolveTreeRoot("/home/user/Code/project/src", fakeHome),
	"/home/user/Code/project/src",
	"resolveTreeRoot should keep safe project paths unchanged",
);
assert.equal(
	resolveTreeRoot("/home/user", fakeHome),
	null,
	"resolveTreeRoot should reject the home directory itself",
);

const tempHome = mkdtempSync(join(tmpdir(), "repo-tree-home-"));
const root = join(tempHome, "Code", "project");

try {
	mkdirSync(join(root, "src", "feature", "deep"), { recursive: true });
	mkdirSync(join(root, "node_modules", "package"), { recursive: true });
	mkdirSync(join(root, ".git", "objects"), { recursive: true });
	mkdirSync(join(root, "dist", "assets"), { recursive: true });
	writeFileSync(join(root, "README.md"), "# Project\n", "utf8");
	writeFileSync(join(root, ".env"), "SECRET=1\n", "utf8");
	writeFileSync(join(root, "bun.lock"), "lock\n", "utf8");
	writeFileSync(join(root, ".DS_Store"), "junk\n", "utf8");
	writeFileSync(join(root, "src", "index.ts"), "export {};\n", "utf8");
	writeFileSync(join(root, "src", "feature", "component.ts"), "export {};\n", "utf8");
	writeFileSync(join(root, "src", "feature", "deep", "too-deep.ts"), "export {};\n", "utf8");
	writeFileSync(join(root, "node_modules", "package", "index.js"), "module.exports = {};\n", "utf8");

	const defaultTree = buildProjectTreeText(root, { home: tempHome });
	assert.match(defaultTree, /project\//, "tree should include the project root directory");
	assert.match(defaultTree, /README\.md/, "tree should include normal files");
	assert.match(defaultTree, /src\//, "tree should include directories within depth");
	assert.match(defaultTree, /index\.ts/, "tree should include files within depth");
	assert.match(defaultTree, /component\.ts/, "default depth 3 should include third-level files");
	assert.doesNotMatch(defaultTree, /too-deep\.ts/, "default depth 3 should not descend indefinitely");
	assert.match(defaultTree, /node_modules\//, "ignored directories should be shown when present");
	assert.match(defaultTree, /\.git\//, "ignored dot directories should be shown when present");
	assert.match(defaultTree, /dist\//, "ignored build directories should be shown when present");
	assert.doesNotMatch(defaultTree, /package\/|index\.js/, "ignored directories should not be descended into");
	assert.doesNotMatch(defaultTree, /\.env|bun\.lock|\.DS_Store/, "ignored files should be hidden");

	const shallowTree = buildProjectTreeText(root, { home: tempHome, maxDepth: 2 });
	assert.match(shallowTree, /index\.ts/, "depth 2 should include files one level below root");
	assert.doesNotMatch(shallowTree, /component\.ts/, "configured depth 2 should hide deeper files");
} finally {
	rmSync(tempHome, { recursive: true, force: true });
}
