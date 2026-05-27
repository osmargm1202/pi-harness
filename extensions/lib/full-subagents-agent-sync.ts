import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { FullSubagentAgentConfig, FullSubagentListMode, FullSubagentsConfig } from "./full-subagents-config.ts";

interface SyncableAgent {
	name: string;
	filePath: string;
	namespace?: string;
}

export interface FullSubagentSyncOptions {
	cwd: string;
	userAgentsDir?: string;
}

export interface FullSubagentSyncReport {
	synced: string[];
	updated: string[];
	unchanged: string[];
	missing: string[];
}

function userAgentRoot(options: FullSubagentSyncOptions): string {
	return options.userAgentsDir ?? join(homedir(), ".pi", "agent", "agents");
}

function packageAgentsDir(): string {
	return join(dirname(dirname(dirname(fileURLToPath(import.meta.url)))), "agents");
}

function nearestProjectAgentsDir(cwd: string): string | undefined {
	let current = cwd;
	while (true) {
		const candidate = join(current, ".pi", "agents");
		try {
			if (lstatSync(candidate).isDirectory()) return candidate;
		} catch {
			// keep walking
		}
		const parent = dirname(current);
		if (parent === current) return undefined;
		current = parent;
	}
}

function frontmatterValue(markdown: string, key: string): string | undefined {
	const match = markdown.match(/^(---\n)([\s\S]*?)(\n---\n?)/);
	if (!match) return undefined;
	const line = match[2].split("\n").find((entry) => new RegExp(`^${key}\\s*:`, "i").test(entry.trim()));
	return line?.replace(new RegExp(`^${key}\\s*:\\s*`, "i"), "").trim() || undefined;
}

function discoverAgentsFromDir(root: string | undefined): SyncableAgent[] {
	if (!root || !existsSync(root)) return [];
	const agents: SyncableAgent[] = [];
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir)) {
			const fullPath = join(dir, entry);
			let stat;
			try {
				stat = lstatSync(fullPath);
			} catch {
				continue;
			}
			if (stat.isDirectory()) {
				walk(fullPath);
				continue;
			}
			if (!(stat.isFile() || stat.isSymbolicLink()) || !entry.endsWith(".md") || entry === "index.md") continue;
			const markdown = readFileSync(fullPath, "utf8");
			const name = frontmatterValue(markdown, "name") ?? entry.slice(0, -3);
			const namespacePath = relative(root, dirname(fullPath));
			agents.push({
				name,
				filePath: fullPath,
				...(namespacePath && namespacePath !== "." ? { namespace: namespacePath.split("\\").join("/") } : {}),
			});
		}
	};
	walk(root);
	return agents;
}

function discoverSyncableAgents(cwd: string, userAgentsDir: string): Map<string, SyncableAgent> {
	const merged = new Map<string, SyncableAgent>();
	for (const agent of discoverAgentsFromDir(packageAgentsDir())) merged.set(agent.name, agent);
	for (const agent of discoverAgentsFromDir(userAgentsDir)) merged.set(agent.name, agent);
	for (const agent of discoverAgentsFromDir(nearestProjectAgentsDir(cwd))) merged.set(agent.name, agent);
	return merged;
}

function formatListMode(value: FullSubagentListMode): string | undefined {
	if (value === "inherit") return undefined;
	if (Array.isArray(value)) return value.join(", ");
	return value;
}

function configuredFrontmatter(agent: FullSubagentAgentConfig): Record<string, string> {
	return Object.fromEntries(
		Object.entries({
			model: agent.model?.trim(),
			tools: formatListMode(agent.tools),
			skills: formatListMode(agent.skills),
			mcp: formatListMode(agent.mcp),
			extensions: formatListMode(agent.extensions),
		}).filter(([, value]) => typeof value === "string" && value.trim().length > 0),
	) as Record<string, string>;
}

function upsertFrontmatter(markdown: string, fields: Record<string, string>): string {
	const match = markdown.match(/^(---\n)([\s\S]*?)(\n---\n?)([\s\S]*)$/);
	if (!match) {
		const frontmatter = Object.entries(fields).map(([key, value]) => `${key}: ${value}`).join("\n");
		return `---\n${frontmatter}\n---\n\n${markdown.trimStart()}`;
	}

	const [, opening, frontmatterBlock, closing, body] = match;
	const lines = frontmatterBlock.split("\n");
	for (const [key, value] of Object.entries(fields)) {
		const index = lines.findIndex((line) => new RegExp(`^${key}\\s*:`, "i").test(line.trim()));
		if (index >= 0) lines[index] = `${key}: ${value}`;
		else lines.push(`${key}: ${value}`);
	}
	return `${opening}${lines.join("\n")}${closing}${body}`;
}

function targetPathForAgent(agent: SyncableAgent, root: string): string {
	return join(root, ...(agent.namespace ? agent.namespace.split("/") : []), `${agent.name}.md`);
}

export function syncFullSubagentOverrides(config: FullSubagentsConfig, options: FullSubagentSyncOptions): FullSubagentSyncReport {
	const report: FullSubagentSyncReport = { synced: [], updated: [], unchanged: [], missing: [] };
	const root = userAgentRoot(options);
	const discoverable = discoverSyncableAgents(options.cwd, root);

	for (const [agentName, agentConfig] of Object.entries(config.agents)) {
		const fields = configuredFrontmatter(agentConfig);
		if (Object.keys(fields).length === 0) continue;

		const source = discoverable.get(agentName);
		if (!source) {
			report.missing.push(agentName);
			continue;
		}

		const targetPath = targetPathForAgent(source, root);
		const sourceMarkdown = existsSync(targetPath) ? readFileSync(targetPath, "utf8") : readFileSync(source.filePath, "utf8");
		const nextMarkdown = upsertFrontmatter(sourceMarkdown, fields);
		if (existsSync(targetPath) && readFileSync(targetPath, "utf8") === nextMarkdown) {
			report.unchanged.push(agentName);
			continue;
		}

		mkdirSync(dirname(targetPath), { recursive: true });
		const existed = existsSync(targetPath);
		writeFileSync(targetPath, nextMarkdown, "utf8");
		(existed ? report.updated : report.synced).push(agentName);
	}

	for (const key of ["synced", "updated", "unchanged", "missing"] as const) report[key].sort((a, b) => a.localeCompare(b));
	return report;
}
