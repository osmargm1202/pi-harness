import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateRepoIndex, loadRepoIndex } from "../extensions/lib/repo-index.ts";

const root = mkdtempSync(join(tmpdir(), "pi-repo-index-"));
try {
	writeFileSync(join(root, "package.json"), JSON.stringify({ name: "demo", scripts: { test: "node" } }, null, 2));
	mkdirSync(join(root, "src"), { recursive: true });
	writeFileSync(join(root, "src", "main.ts"), "import { helper } from './util';\nexport function main() {\n\treturn helper();\n}\n");
	writeFileSync(join(root, "src", "util.ts"), "export function helper() {\n\treturn 'ok';\n}\n");
	mkdirSync(join(root, "node_modules", "noise"), { recursive: true });
	writeFileSync(join(root, "node_modules", "noise", "index.ts"), "export const noisy = true;\n");
	mkdirSync(join(root, ".pi", "extensions"), { recursive: true });
	writeFileSync(join(root, ".pi", "extensions", "local.ts"), "export default 1;\n");
	mkdirSync(join(root, ".agents"), { recursive: true });
	writeFileSync(join(root, ".agents", "agent.md"), "agent docs\n");
	mkdirSync(join(root, "__pycache__"), { recursive: true });
	writeFileSync(join(root, "__pycache__", "x.pyc"), "binary-ish\n");

	const first = generateRepoIndex({ rootDir: root });
	assert.equal(first.project.name, "demo");
	assert(first.files["src/main.ts"], "source file should be indexed");
	assert.equal(first.files["src/main.ts"].generated.language, "typescript");
	assert.deepEqual(first.files["src/main.ts"].generated.exports, ["main"]);
	assert(first.files["package.json"], "package.json should be indexed");
	assert(!first.files["node_modules/noise/index.ts"], "node_modules should be ignored");
	assert(!first.files[".pi/extensions/local.ts"], ".pi should be ignored");
	assert(!first.files[".agents/agent.md"], ".agents should be ignored");
	assert(!first.files["__pycache__/x.pyc"], "__pycache__ should be ignored");

	const persistedPath = join(root, ".pi-cache", "repo-index.json");
	const persisted = loadRepoIndex(persistedPath)!;
	persisted.files["src/main.ts"].persistent.summary = "Main entry used by agents.";
	persisted.files["src/main.ts"].persistent.notes.push("Keep this summary during refresh.");
	writeFileSync(persistedPath, `${JSON.stringify(persisted, null, 2)}\n`);

	writeFileSync(join(root, "src", "main.ts"), "import { helper } from './util';\nexport function main() {\n\treturn helper() + '!';\n}\n");
	const second = generateRepoIndex({ rootDir: root });
	assert.equal(second.files["src/main.ts"].persistent.summary, "Main entry used by agents.");
	assert.deepEqual(second.files["src/main.ts"].persistent.notes, ["Keep this summary during refresh."]);
	assert.notEqual(second.files["src/main.ts"].generated.hash, first.files["src/main.ts"].generated.hash);

	const context = readFileSync(join(root, ".pi-cache", "repo-context.md"), "utf8");
	assert(context.includes("# Repo Context"));
	assert(context.includes("src/main.ts"));
	assert(context.includes("Main entry used by agents."));
	assert(!context.includes("node_modules/noise"));
} finally {
	rmSync(root, { recursive: true, force: true });
}
