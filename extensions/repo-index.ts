import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { generateRepoIndex, loadRepoIndex } from "./lib/repo-index.ts";

const STATUS_KEY = "repo-index";
const MAX_CONTEXT_CHARS = 24_000;
const REPO_CONTEXT_MARKER = "<!-- pi-repo-index-context -->";

function rootFromContext(ctx: ExtensionContext): string {
	return ctx.getSystemPrompt?.().match(/Current working directory: ([^\n]+)/)?.[1]?.trim() || process.cwd();
}

function formatStatus(rootDir: string): string {
	const indexPath = join(rootDir, ".pi-cache", "repo-index.json");
	const index = loadRepoIndex(indexPath);
	if (!index) return "repo-index: missing";
	const dirty = index.git.dirty ? "dirty" : "fresh";
	return `repo-index: ready · ${index.stats.files} files · ${dirty}`;
}

function readContext(rootDir: string): string | undefined {
	const contextPath = join(rootDir, ".pi-cache", "repo-context.md");
	if (!existsSync(contextPath)) return undefined;
	const content = readFileSync(contextPath, "utf8");
	if (content.length <= MAX_CONTEXT_CHARS) return content;
	return `${content.slice(0, MAX_CONTEXT_CHARS)}\n\n<!-- repo-context truncated for prompt budget; use .pi-cache/repo-index.json or /repo-index for full index. -->\n`;
}

export function buildRepoIndexSystemPrompt(systemPrompt: string, repoContext: string): string {
	if (systemPrompt.includes(REPO_CONTEXT_MARKER)) return systemPrompt;
	return `${systemPrompt}\n\n${REPO_CONTEXT_MARKER}\nRepository index context is injected only once. At session/subagent start, use it for orientation before calling directory listing tools; read real files/ranges when exact code is needed. If you learn useful repository structure, solve a problem, or change files, update .pi-cache/repo-index.json persistent.summary/notes/relatedFiles/ownerHints when relevant and refresh .pi-cache/repo-context.md with /repo-init or /repo-index.\n\n${repoContext}`;
}

async function refreshRepoIndex(ctx: ExtensionContext): Promise<void> {
	const rootDir = rootFromContext(ctx);
	try {
		const index = generateRepoIndex({ rootDir });
		ctx.ui.setStatus(STATUS_KEY, `repo-index: ready · ${index.stats.files} files · ${index.git.dirty ? "dirty" : "fresh"}`);
	} catch (error) {
		ctx.ui.setStatus(STATUS_KEY, "repo-index: error");
		ctx.ui.notify(`repo-index failed: ${error instanceof Error ? error.message : String(error)}`, "warning");
	}
}

export default function repoIndexExtension(pi: ExtensionAPI) {
	let shouldInjectStartupContext = true;

	pi.on("session_start", async (_event, ctx) => {
		shouldInjectStartupContext = true;
		await refreshRepoIndex(ctx);
	});

	pi.on("agent_end", async (_event, ctx) => {
		await refreshRepoIndex(ctx);
	});

	pi.on("before_agent_start", async (_event, ctx) => {
		if (!shouldInjectStartupContext) return;
		shouldInjectStartupContext = false;
		const rootDir = rootFromContext(ctx);
		if (!existsSync(join(rootDir, ".pi-cache", "repo-index.json"))) await refreshRepoIndex(ctx);
		const context = readContext(rootDir);
		if (!context) return;
		ctx.ui.setStatus(STATUS_KEY, formatStatus(rootDir));
		return {
			systemPrompt: buildRepoIndexSystemPrompt(_event.systemPrompt, context),
		};
	});

	pi.registerCommand("repo-index", {
		description: "Refresh .pi-cache/repo-index.json and .pi-cache/repo-context.md",
		handler: async (_args, ctx) => {
			await refreshRepoIndex(ctx);
			ctx.ui.notify(formatStatus(rootFromContext(ctx)), "info");
		},
	});

	pi.registerCommand("repo-init", {
		description: "Refresh repo context now and mark startup context for reinjection on the next agent turn",
		handler: async (_args, ctx) => {
			await refreshRepoIndex(ctx);
			shouldInjectStartupContext = true;
			ctx.ui.notify(`${formatStatus(rootFromContext(ctx))}; repo context will be injected on the next turn`, "info");
		},
	});
}
