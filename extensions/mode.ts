import { existsSync, readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DEFAULT_MODE_ORDER, loadOrgmConfig, type OrgmModeName as ConfigModeName } from "./lib/orgm-config.ts";
import { isOrgmExtensionEnabled } from "./lib/orgm-extension-config.ts";
import { SUBAGENT_ENV_FLAG } from "./lib/subagent-runtime-model.ts";

export type OrgmModeName = "plan" | "build" | "ask" | "sdd" | "tdd";

export const MODE_STATE_ENTRY = "orgm-mode";
export const MODE_STATE_EVENT = "orgm:mode-changed";

const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const MODE_PROMPTS_DIR = join(PACKAGE_ROOT, "agents");
const MODE_DETAILS: Record<OrgmModeName, { label: string; colors: string[]; tools: string[] }> = {
	plan: { label: "PLAN", colors: ["warning"], tools: [
		"read",
		"bash",
		"grep",
		"find",
		"ls",
		"deploy_agent",
		"ask_user_question",
		"engram_mem_search",
		"engram_mem_context",
		"engram_mem_get_observation",
		"engram_mem_save",
		"engram_mem_update",
		"engram_mem_save_prompt",
		"engram_mem_session_summary",
		"engram_mem_capture_passive",
	] },
	build: { label: "BUILD", colors: ["accent"], tools: [] },
	ask: { label: "ASK", colors: ["cyan", "accent"], tools: ["read", "bash", "grep", "find", "ls", "engram_mem_search", "engram_mem_context", "engram_mem_get_observation"] },
	sdd: { label: "SDD", colors: ["error"], tools: [
		"read",
		"bash",
		"grep",
		"find",
		"ls",
		"deploy_agent",
		"ask_user_question",
		"engram_mem_search",
		"engram_mem_context",
		"engram_mem_get_observation",
		"engram_mem_save",
		"engram_mem_update",
		"engram_mem_save_prompt",
		"engram_mem_session_summary",
		"engram_mem_capture_passive",
	] },
	tdd: { label: "TDD", colors: ["purple", "accent"], tools: [
		"read",
		"bash",
		"grep",
		"find",
		"ls",
		"deploy_agent",
		"ask_user_question",
		"engram_mem_search",
		"engram_mem_context",
		"engram_mem_get_observation",
		"engram_mem_save",
		"engram_mem_update",
		"engram_mem_save_prompt",
		"engram_mem_session_summary",
		"engram_mem_capture_passive",
	] },
};

const SAFE_BASH_PREFIXES = [
	"pwd", "ls", "find", "rg", "grep", "test", "[", "echo", "printf", "wc", "head", "tail",
	"git status", "git diff", "git log", "git show", "git branch", "git rev-parse", "git ls-files",
];
const SAFE_GIT_COMMAND_PREFIXES = ["git add", "git commit"];
const SAFE_GIT_REVIEW_PREFIXES = ["git status", "git diff", "git log", "git show", "git branch", "git rev-parse", "git ls-files"];
const DANGEROUS_BASH = /(^|[;&|`$()\n])\s*(rm|mv|cp|mkdir|rmdir|touch|chmod|chown|sudo|git\s+(push|reset|checkout|switch|merge|rebase|clean|worktree|stash)|npm\s+install|pnpm\s+install|bun\s+(add|install)|cargo\s+install)\b/i;
const OPTIONAL_TOOL_PREFIXES = ["exa", "chrome-devtools", "obsidian"];
const SHELL_COMPOSITE_OPERATOR = /(?:&&|\|\||;|\n|\|)/;


function isModeName(value: string): value is OrgmModeName {
	return ["plan", "build", "ask", "sdd", "tdd"].includes(value);
}

function normalizeMode(value: unknown, fallback: OrgmModeName): OrgmModeName {
	if (typeof value !== "string") return fallback;
	const clean = value.trim().toLowerCase();
	return isModeName(clean) ? clean : fallback;
}

export function getNextMode(mode: OrgmModeName, order: readonly ConfigModeName[] = DEFAULT_MODE_ORDER): OrgmModeName {
	const modes = order.filter((item): item is OrgmModeName => typeof item === "string" && isModeName(item));
	const cycle = modes.length > 0 ? modes : DEFAULT_MODE_ORDER;
	const index = cycle.indexOf(mode);
	return cycle[(index + 1) % cycle.length] ?? "plan";
}

export function restoreModeState(entries: readonly any[], fallback: OrgmModeName): OrgmModeName {
	for (let index = entries.length - 1; index >= 0; index -= 1) {
		const entry = entries[index];
		if (entry?.type !== "custom" || entry.customType !== MODE_STATE_ENTRY) continue;
		return normalizeMode(entry.data?.mode, fallback);
	}
	return fallback;
}

function normalizedRel(path: string): string {
	return normalize(path).replace(/\\/g, "/").replace(/^\.\//, "");
}

export function isWriteAllowedInMode(mode: OrgmModeName, path: string): boolean {
	if (mode === "build") return true;
	if (mode === "ask" || mode === "sdd" || mode === "tdd") return false;
	const rel = normalizedRel(path);
	return rel.startsWith("docs/") || rel.startsWith("plans/") || /^agents\/(plan|build|ask|sdd|tdd)\.md$/.test(rel);
}

function allowsGitCommitWorkflow(mode: OrgmModeName): boolean {
	return mode === "plan" || mode === "sdd" || mode === "tdd";
}

function isSafeGitCommand(command: string, mode: OrgmModeName): boolean {
	const trimmed = command.trim().toLowerCase();
	if (!trimmed.startsWith("git ")) return false;
	if (SHELL_COMPOSITE_OPERATOR.test(trimmed)) return false;
	if (SAFE_GIT_REVIEW_PREFIXES.some((prefix) => trimmed === prefix || trimmed.startsWith(`${prefix} `))) return true;
	if (!allowsGitCommitWorkflow(mode)) return false;
	return SAFE_GIT_COMMAND_PREFIXES.some((prefix) => trimmed === prefix || trimmed.startsWith(`${prefix} `));
}

function isSafeBash(command: string, mode: OrgmModeName): boolean {
	const trimmed = command.trim();
	if (!trimmed) return true;
	if (isSafeGitCommand(trimmed, mode)) return true;
	if (DANGEROUS_BASH.test(trimmed)) return false;
	return SAFE_BASH_PREFIXES.some((prefix) => trimmed === prefix || trimmed.startsWith(`${prefix} `));
}

function readModePrompt(mode: OrgmModeName): string {
	const path = join(MODE_PROMPTS_DIR, `${mode}.md`);
	if (!existsSync(path)) return "";
	return readFileSync(path, "utf8").trim();
}

function toolNames(pi: ExtensionAPI): string[] {
	try {
		return (pi.getAllTools?.() ?? []).map((tool: any) => tool.name).filter((name: unknown): name is string => typeof name === "string");
	} catch {
		return [];
	}
}

function isOptionalTool(name: string): boolean {
	return OPTIONAL_TOOL_PREFIXES.some((prefix) => {
		if (name === prefix) return true;
		const suffix = name.slice(prefix.length);
		return suffix.length > 0 && /^[._/-]/.test(suffix);
	});
}

function activeToolsForMode(pi: ExtensionAPI, mode: OrgmModeName): string[] {
	const available = toolNames(pi);
	if (mode === "build") return available;
	const allow = new Set(MODE_DETAILS[mode].tools);
	for (const name of available) {
		if (isOptionalTool(name)) allow.add(name);
	}
	return available.filter((name) => allow.has(name));
}

function setModeTools(pi: ExtensionAPI, mode: OrgmModeName): void {
	const names = activeToolsForMode(pi, mode);
	if (names.length > 0) pi.setActiveTools?.(names);
}

export function formatModeLabel(mode: OrgmModeName): string {
	return MODE_DETAILS[mode].label;
}

export function getModeColorCandidates(mode: OrgmModeName): string[] {
	return [...MODE_DETAILS[mode].colors];
}

export function safeThemeFg(theme: { fg?: (color: string, text: string) => string } | undefined, colors: string[], text: string): string {
	if (!theme?.fg) return text;
	for (const color of colors) {
		try {
			return theme.fg(color, text);
		} catch {
			// Try next color candidate for themes that do not define this token.
		}
	}
	return text;
}

function setModeStatus(ctx: ExtensionContext, mode: OrgmModeName): void {
	const details = MODE_DETAILS[mode];
	const text = safeThemeFg(ctx.ui.theme, details.colors, details.label);
	ctx.ui.setStatus?.("orgm-mode", text);
}

function extractPath(input: any): string | undefined {
	if (typeof input?.path === "string") return input.path;
	if (Array.isArray(input?.edits) && typeof input.edits[0]?.path === "string") return input.edits[0].path;
	return undefined;
}

function isSubagentRuntime(): boolean {
	if (process.env[SUBAGENT_ENV_FLAG] === "1") return true;
	return Boolean(process.env.PI_SUBAGENT_RUNTIME_ID?.trim() || process.env.PI_SUBAGENT_DEPLOYMENT_ID?.trim());
}

export default function modeExtension(pi: ExtensionAPI, options: { configPath?: string } = {}) {
	if (!isOrgmExtensionEnabled("mode")) return;
	if (isSubagentRuntime()) return;

	let config = loadOrgmConfig(options.configPath);
	let currentMode = normalizeMode(config.mode.defaultMode, "plan");

	const applyMode = (ctx: ExtensionContext, mode: OrgmModeName, notify = false) => {
		currentMode = mode;
		setModeTools(pi, currentMode);
		setModeStatus(ctx, currentMode);
		pi.appendEntry(MODE_STATE_ENTRY, { mode: currentMode });
		pi.events?.emit?.(MODE_STATE_EVENT, { mode: currentMode, label: formatModeLabel(currentMode), colors: getModeColorCandidates(currentMode) });
		if (notify) ctx.ui.notify(`Mode: ${currentMode}`, "success");
	};

	pi.registerCommand("mode", {
		description: "Switch ORGM mode: /mode [plan|build|ask|sdd|tdd]",
		getArgumentCompletions: (prefix: string) => DEFAULT_MODE_ORDER.filter((mode) => mode.startsWith(prefix.trim().toLowerCase())).map((mode) => ({ value: mode, label: mode })),
		handler: async (args: string, ctx: ExtensionContext) => {
			const requested = args.trim().toLowerCase();
			if (!requested) {
				ctx.ui.notify(`Mode: ${currentMode}`, "success");
				return;
			}
			const next = normalizeMode(requested, currentMode);
			if (next !== requested) {
				ctx.ui.notify("Usage: /mode [plan|build|ask|sdd|tdd]", "warning");
				return;
			}
			applyMode(ctx, next, true);
		},
	});

	pi.registerShortcut("alt+1", {
		description: "Cycle ORGM mode",
		handler: async (ctx: ExtensionContext) => applyMode(ctx, getNextMode(currentMode, config.mode.allowedModes), true),
	});

	pi.on("session_start", async (_event, ctx) => {
		config = loadOrgmConfig(options.configPath);
		const fallback = normalizeMode(config.mode.defaultMode, "plan");
		currentMode = restoreModeState(ctx.sessionManager?.getEntries?.() ?? [], fallback);
		setModeTools(pi, currentMode);
		pi.events?.emit?.(MODE_STATE_EVENT, { mode: currentMode, label: formatModeLabel(currentMode), colors: getModeColorCandidates(currentMode) });
		if (ctx.hasUI) setModeStatus(ctx, currentMode);
	});

	pi.on("before_agent_start", async (event) => {
		const prompt = readModePrompt(currentMode);
		return {
			systemPrompt: `${event.systemPrompt}\n\n## ORGM Mode: ${currentMode}\n${prompt}`,
		};
	});

	pi.on("tool_call", async (event) => {
		if (currentMode === "build") return;
		if (event.toolName === "write" || event.toolName === "edit" || event.toolName === "upload_file") {
			const path = extractPath(event.input);
			if (!path || !isWriteAllowedInMode(currentMode, path)) {
				return { block: true, reason: `${currentMode} mode blocks writes outside allowed planning paths.` };
			}
		}
		if (event.toolName === "bash") {
			const command = String((event.input as any)?.command ?? "");
			if (!isSafeBash(command, currentMode)) return { block: true, reason: `${currentMode} mode blocks unsafe bash commands.` };
		}
	});
}
