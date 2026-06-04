import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function walkMarkdown(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return walkMarkdown(path);
		return entry.isFile() && entry.name.endsWith(".md") ? [path] : [];
	});
}

function frontmatterTools(content: string): string[] {
	const match = content.match(/^---\n([\s\S]*?)\n---/);
	assert(match, "subagent should have frontmatter");
	const toolsLine = match[1].split("\n").find((line) => line.startsWith("tools:"));
	assert(toolsLine, "subagent should declare tools");
	return toolsLine.slice("tools:".length).split(",").map((tool) => tool.trim()).filter(Boolean);
}

for (const path of walkMarkdown("assets/subagents")) {
	const tools = frontmatterTools(readFileSync(path, "utf8"));
	assert(tools.includes("ask_user_question"), `${path} should include ask_user_question so subagents use ask.ts for clarification`);
	assert(tools.some((tool) => tool.startsWith("engram_mem_")), `${path} should preserve Engram tools in subagent allowlist`);
}
