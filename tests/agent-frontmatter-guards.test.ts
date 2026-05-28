import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = process.cwd();
const agentsRoot = join(repoRoot, "agents");

const ENGRAM_TOOLS = [
	"engram_mem_context",
	"engram_mem_search",
	"engram_mem_get_observation",
	"engram_mem_save",
	"engram_mem_save_prompt",
	"engram_mem_session_start",
	"engram_mem_session_end",
	"engram_mem_session_summary",
	"engram_mem_suggest_topic_key",
	"engram_mem_update",
	"engram_mem_capture_passive",
];

const DELEGATION_HEADING = "## Delegation rule";
const STRICT_DELEGATION_PHRASE =
	"Agents and orchestrators in this folder must delegate exploration, verification, and information gathering to appropriate subagents.";

function listMarkdownFiles(dir: string): string[] {
	const files: string[] = [];
	for (const entry of readdirSync(dir)) {
		const entryPath = join(dir, entry);
		const stats = statSync(entryPath);
		if (stats.isDirectory()) {
			files.push(...listMarkdownFiles(entryPath));
			continue;
		}
		if (stats.isFile() && entry.endsWith(".md")) {
			files.push(entryPath);
		}
	}
	return files.sort();
}

function getToolsLine(content: string): string | null {
	const match = content.match(/^tools:\s*(.+)$/m);
	return match ? match[1].trim() : null;
}

for (const filePath of listMarkdownFiles(agentsRoot)) {
	const relativePath = relative(repoRoot, filePath);
	const content = readFileSync(filePath, "utf8");
	const toolsLine = getToolsLine(content);

	if (toolsLine) {
		for (const tool of ENGRAM_TOOLS) {
			assert.match(
				toolsLine,
				new RegExp(`(?:^|, )${tool}(?:,|$)`),
				`${relativePath} tools must include ${tool}`,
			);
		}
	}

	assert.doesNotMatch(
		content,
		/^## Delegation rule$/m,
		`${relativePath} must not define ${DELEGATION_HEADING}`,
	);
	assert.doesNotMatch(
		content,
		new RegExp(STRICT_DELEGATION_PHRASE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
		`${relativePath} must not require strict folder subagent delegation`,
	);
}
