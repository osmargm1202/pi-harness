import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const roots = ["extensions"];
const commandPattern = /registerCommand\(\s*["'`]([^"'`]+)["'`]/g;

function collectTypeScriptFiles(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) return collectTypeScriptFiles(fullPath);
		return entry.isFile() && entry.name.endsWith(".ts") ? [fullPath] : [];
	});
}

const commandNames = roots
	.flatMap(collectTypeScriptFiles)
	.filter((file) => file === "extensions/lib/orgm-flow.ts" || statSync(file).isFile())
	.flatMap((file) => {
		const source = readFileSync(file, "utf8");
		return Array.from(source.matchAll(commandPattern), (match) => ({
			file: relative(process.cwd(), file),
			name: match[1],
		}));
	});

assert(
	commandNames.length > 0,
	"static command scan should find registered extension commands",
);

const nonOrgmCommands = commandNames.filter(({ name }) => !name.startsWith("orgm-") && name !== "mode");
assert.deepEqual(
	nonOrgmCommands,
	[],
	"all registered pi command names must use the orgm-* namespace except /mode",
);

const extensionSources = roots
	.flatMap(collectTypeScriptFiles)
	.map((file) => readFileSync(file, "utf8"));
const bannedActiveTokens = ["full_subagent_task", "full_query_team", "orgm-full-subagents", "/full-subagents", "strict full-subagents", "FULL_SUBAGENT"];
assert.deepEqual(
	extensionSources.filter((source) => bannedActiveTokens.some((token) => source.includes(token))),
	[],
	"active extension sources must not include deprecated full-subagents tooling or prompts",
);
