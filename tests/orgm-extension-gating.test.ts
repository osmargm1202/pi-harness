import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const extensionsRoot = "extensions";
const coreAlwaysOn = new Set(["extensions/orgm.ts"]);

function collectTypeScriptFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) return entry.name === "lib" ? [] : collectTypeScriptFiles(fullPath);
		return entry.isFile() && entry.name.endsWith(".ts") ? [fullPath] : [];
	});
}

for (const file of collectTypeScriptFiles(extensionsRoot)) {
	const rel = relative(process.cwd(), file);
	if (coreAlwaysOn.has(rel) || !statSync(file).isFile()) continue;
	const source = readFileSync(file, "utf8");
	if (!source.includes("export default function")) continue;
	assert.match(source, /isOrgmExtensionEnabled\(/, `${rel} must check orgm extension enabled config`);
}

const askSource = readFileSync("extensions/ask.ts", "utf8");
assert.match(askSource, /isOrgmExtensionEnabled\("ask",[^\n]+"questions"\)/, "ask questions must have feature gate");
assert.match(askSource, /isOrgmExtensionEnabled\("ask",[^\n]+"permissions"\)/, "ask permissions must have feature gate");

const todoSource = readFileSync("extensions/todo.ts", "utf8");
assert.match(todoSource, /isOrgmExtensionEnabled\("todo"\)/, "todo must default through orgm extension config");
