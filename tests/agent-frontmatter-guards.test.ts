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
const INDEX_STRICT_DELEGATION_PATTERNS = [
	/mandatory orchestrator/i,
	/coordinator-only/i,
	/do not execute implementation, research, or task work inline/i,
	/only inline work is user-facing synthesis/i,
	/do not write code directly/i,
	/always query/i,
	/must delegate/i,
	/use deploy_agent to delegate all concrete work/i,
	/delegate all hands-on work/i,
	/coding-expert owns/i,
	/hybrid execution guard/i,
	/for any request requiring repository exploration, code execution, or file changes, delegate/i,
];
const INLINE_SMALL_SIMPLE_ONLY_PATTERNS = [
	/small or simple work inline/i,
	/inline for small\/simple work/i,
	/use inline execution when the task is small/i,
];

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

	if (relativePath.match(/^agents\/.*\/index\.md$/)) {
		for (const pattern of INDEX_STRICT_DELEGATION_PATTERNS) {
			assert.doesNotMatch(
				content,
				pattern,
				`${relativePath} must not force query_team/deploy_agent or block inline work`,
			);
		}
		for (const pattern of INLINE_SMALL_SIMPLE_ONLY_PATTERNS) {
			assert.doesNotMatch(
				content,
				pattern,
				`${relativePath} must not frame inline work as only small/simple`,
			);
		}
	}
}

const piOrchestrator = readFileSync(join(agentsRoot, "pi-orchestrator", "index.md"), "utf8");
assert.match(piOrchestrator, /Handle work inline when the task does not warrant deploying agents or passing context/i);
assert.match(piOrchestrator, /query_team.*specialist guidance is warranted.*parallel.*team coordination|specialist guidance is warranted.*parallel.*team coordination.*query_team/i);
assert.match(piOrchestrator, /deploy_agent.*specialist implementation, review, or verification warrants a dedicated agent|specialist implementation, review, or verification warrants a dedicated agent.*deploy_agent/i);
