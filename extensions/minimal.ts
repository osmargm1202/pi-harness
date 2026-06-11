import { basename, dirname, extname, normalize } from "node:path";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import {
	isToolCallEventType,
	type ExtensionAPI,
	type ExtensionContext,
	type Theme,
} from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { loadOrgmConfigSlice, saveOrgmConfigSlice } from "./lib/orgm-config.ts";
import { renderSkillChipRows, type ChipStyleKind, type SkillStatus } from "./lib/minimal-skill.ts";
import {
	renderTitleContextLine,
	sanitizeTitle,
	SESSION_TITLE_ENTRY_TYPE,
	TITLE_STATE_EVENT,
	type TitleStatus,
} from "./lib/minimal-title.ts";
import {
	PI_CAVEMAN_STATE_EVENT,
	PI_CAVEMAN_STATE_KEY,
	formatObservedCavemanStatus,
	normalizeObservedCavemanState,
	type ObservedCavemanState,
} from "./lib/caveman-state.ts";
import { isOrgmExtensionEnabled } from "./lib/orgm-extension-config.ts";
import {
	buildStarshipLine,
	readStarshipProjectState,
	type StarshipGitStatus,
	type StarshipRuntime,
} from "./lib/starship.ts";
import { createZentuiEditorFactory, formatProviderLabel, formatThinkingLabel } from "./lib/zentui-editor.ts";
type OrgmModeName = string;
type MinimalSkillsAction = "on" | "off" | "toggle" | "clear";

export function formatMinimalModeLabel(mode: OrgmModeName): string {
	return mode.trim().toUpperCase() || "PI";
}

export interface MinimalSkillsConfig {
	enabled: boolean;
}

export function loadMinimalSkillsConfig(configPath?: string): MinimalSkillsConfig {
	return { ...loadOrgmConfigSlice("minimalSkills", configPath) };
}

function saveMinimalSkillsConfig(config: MinimalSkillsConfig): void {
	saveOrgmConfigSlice("minimalSkills", config);
}

function sanitizeSkillName(name: string): string | undefined {
	const trimmed = name.trim();
	return trimmed ? trimmed : undefined;
}

function getSkillNameFromPath(path: string): string | undefined {
	const normalizedPath = normalize(path).replace(/\\/g, "/");
	if (extname(normalizedPath).toLowerCase() !== ".md") return undefined;

	if (basename(normalizedPath) === "SKILL.md") {
		const skillName = basename(dirname(normalizedPath));
		if (skillName === "skills") return undefined;
		return sanitizeSkillName(skillName);
	}

	if (basename(dirname(normalizedPath)) !== "skills") return undefined;
	return sanitizeSkillName(basename(normalizedPath, extname(normalizedPath)));
}

function renderSkillsRows(theme: Theme, width: number, loadedSkills: Map<string, SkillStatus>): string[] {
	return renderSkillChipRows(loadedSkills, width, (kind: ChipStyleKind, text: string) => {
		if (kind === "skillLoading") return theme.fg("warning", text);
		if (kind === "skillError") return theme.fg("error", text);
		if (kind === "skillBorder" || kind === "skillGap") return theme.fg("borderAccent", text);
		return theme.fg("text", text);
	});
}

function renderTitleStatusLine(
	theme: Theme,
	status: TitleStatus,
	width: number,
	folderLabel: string,
	modeLabel: string,
): string {
	return renderTitleContextLine(status, width, folderLabel, modeLabel, (kind, text) => {
		if (kind === "error") return theme.fg("error", text);
		if (kind === "warning") return theme.fg("warning", text);
		if (kind === "dim") return theme.fg("text", text);
		if (kind === "mode") return theme.fg("accent", text);
		return theme.fg("accent", text);
	});
}

function restoreTitleStatus(entries: Array<{ type?: string; customType?: string; data?: { title?: string } }>): TitleStatus {
	const saved = entries
		.filter((entry) => entry.type === "custom" && entry.customType === SESSION_TITLE_ENTRY_TYPE)
		.pop();
	const title = saved?.data?.title ? sanitizeTitle(saved.data.title) : "";
	return title ? { state: "ready", title } : { state: "idle" };
}

function restoreObservedCavemanState(entries: Array<{ type?: string; customType?: string; data?: unknown }>): ObservedCavemanState | null {
	for (let i = entries.length - 1; i >= 0; i -= 1) {
		const entry = entries[i];
		if (entry?.type !== "custom" || entry.customType !== PI_CAVEMAN_STATE_KEY) continue;
		const normalized = normalizeObservedCavemanState(entry.data);
		if (normalized) return normalized;
	}
	return null;
}

function formatCompactNumber(value: number): string {
	if (!Number.isFinite(value)) return "0";
	if (value < 1000) return `${Math.round(value)}`;
	if (value < 1_000_000) return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)}k`;
	return `${(value / 1_000_000).toFixed(1)}m`;
}

export interface MinimalTokenSummaryUsage {
	input: number;
	output: number;
	cacheRead?: number;
	cacheWrite?: number;
}

export function formatMinimalTokenSummary(usage: MinimalTokenSummaryUsage): string {
	const input = usage.input || 0;
	const output = usage.output || 0;
	const cacheRead = usage.cacheRead || 0;
	const cacheWrite = usage.cacheWrite || 0;
	const parts = [`↑${formatCompactNumber(input)}`, `↓${formatCompactNumber(output)}`];
	if (cacheRead > 0) parts.push(`R${formatCompactNumber(cacheRead)}`);
	if (cacheWrite > 0) parts.push(`W${formatCompactNumber(cacheWrite)}`);
	const latestPromptTokens = input + cacheRead + cacheWrite;
	if ((cacheRead > 0 || cacheWrite > 0) && latestPromptTokens > 0) {
		parts.push(`CH${((cacheRead / latestPromptTokens) * 100).toFixed(1)}%`);
	}
	return parts.join(" ");
}

function formatCurrency(value: number): string {
	if (!Number.isFinite(value) || value <= 0) return "$0.000";
	if (value < 0.001) return `$${value.toFixed(4)}`;
	return `$${value.toFixed(3)}`;
}

function buildContextBar(percent: number, width = 10): string {
	const clamped = Math.max(0, Math.min(100, percent));
	const filled = Math.max(0, Math.min(width, Math.round((clamped / 100) * width)));
	return `[${"#".repeat(filled)}${"-".repeat(width - filled)}]${Math.round(clamped)}%`;
}

function getFolderLabel(cwd: string): string {
	const trimmed = cwd.replace(/[\\/]+$/, "");
	const folder = basename(trimmed) || trimmed || ".";
	return ` ${folder}`;
}

function formatDuration(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
	if (minutes > 0) return `${minutes}m ${seconds}s`;
	return `${seconds}s`;
}

function renderMinimalExtraLine(
	theme: Theme,
	width: number,
	status: TitleStatus,
	timerLabel: string,
	observedCaveman: ObservedCavemanState | null,
): string {
	const parts: string[] = [];
	if (status.state === "ready" && status.title) parts.push(theme.fg("accent", status.title));
	else if (status.state === "generating") parts.push(theme.fg("warning", `${status.frame ?? "⠋"} Generando título…`));
	else if (status.state === "error") {
		parts.push(theme.fg("error", status.title ? `⚠ ${status.title} · /orgm-title regen` : "⚠ Error generando título · /orgm-title regen"));
	}
	if (timerLabel) parts.push(theme.fg("borderAccent", timerLabel));
	if (observedCaveman) parts.push(theme.fg(observedCaveman.enabled ? "accent" : "text", formatObservedCavemanStatus(observedCaveman)));
	const line = parts.join(theme.fg("borderAccent", " · "));
	return truncateToWidth(line || theme.fg("text", ""), width);
}

function normalizeMinimalSkillsAction(value: string): MinimalSkillsAction | undefined {
	const normalized = value.trim().toLowerCase();
	if (normalized === "on" || normalized === "off" || normalized === "toggle" || normalized === "clear") {
		return normalized;
	}
	return undefined;
}

function buildMinimalSkillsUsage(): string {
	return "Usage: /orgm-minimal-skills <on|off|toggle|clear>";
}

export default function (pi: ExtensionAPI) {
	if (!isOrgmExtensionEnabled("minimal")) return;

	const currentMode: OrgmModeName = "pi";
	let observedCaveman: ObservedCavemanState | null = null;
	let showSkillsStatus = loadMinimalSkillsConfig().enabled;
	let titleStatus: TitleStatus = { state: "idle" };
	let starshipGit: StarshipGitStatus | undefined;
	let starshipRuntime: StarshipRuntime | undefined;
	let activeCtx: ExtensionContext | undefined;
	let timerStartedAt = 0;
	let timerLabel = "";
	let timerHasError = false;
	let timerHandle: ReturnType<typeof setInterval> | undefined;
	let footerHandle: { requestRender: () => void } | null = null;
	const loadedSkills = new Map<string, SkillStatus>();
	const pendingSkillReads = new Map<string, string>();

	const requestRender = () => {
		footerHandle?.requestRender();
	};

	const setTimerLabel = (icon: "⏱" | "✓" | "✕") => {
		if (timerStartedAt === 0) return;
		timerLabel = `${icon} ${formatDuration(Date.now() - timerStartedAt)}`;
		requestRender();
	};

	const stopTimer = () => {
		if (timerHandle) clearInterval(timerHandle);
		timerHandle = undefined;
	};

	const clearTrackedSkills = () => {
		loadedSkills.clear();
		pendingSkillReads.clear();
		requestRender();
	};

	const setSkillStatus = (name: string, status: SkillStatus) => {
		const skillName = sanitizeSkillName(name);
		if (!skillName) return;

		const previous = loadedSkills.get(skillName);
		if (previous === status) return;
		if (status === "loading" && previous === "loaded") return;

		loadedSkills.set(skillName, status);
		requestRender();
	};

	const setSkillsEnabled = (enabled: boolean) => {
		showSkillsStatus = enabled;
		saveMinimalSkillsConfig({ enabled });
		requestRender();
	};

	const installFooter = (ctx: ExtensionContext) => {
		activeCtx = ctx;
		observedCaveman = restoreObservedCavemanState(ctx.sessionManager.getEntries());
		showSkillsStatus = loadMinimalSkillsConfig().enabled;
		titleStatus = restoreTitleStatus(ctx.sessionManager.getEntries());

		const uiWithEditor = ctx.ui as typeof ctx.ui & { getEditorComponent?: () => Parameters<typeof createZentuiEditorFactory>[1] };
		const previousEditor = uiWithEditor.getEditorComponent?.();
		ctx.ui.setEditorComponent(createZentuiEditorFactory(() => ({
			modelLabel: ctx.model?.name || ctx.model?.id || "no-model",
			providerLabel: formatProviderLabel(typeof ctx.model?.provider === "string" ? ctx.model.provider : undefined),
			thinkingLabel: formatThinkingLabel(pi.getThinkingLevel()),
		}), previousEditor));

		void readStarshipProjectState(ctx.cwd).then((state) => {
			starshipGit = state.git;
			starshipRuntime = state.runtime;
			requestRender();
		}).catch(() => {});

		ctx.ui.setFooter((tui, theme, footerData) => {
			footerHandle = tui;
			const unsubscribeBranch = footerData.onBranchChange(() => {
				void readStarshipProjectState(ctx.cwd).then((state) => {
					starshipGit = state.git;
					starshipRuntime = state.runtime;
					tui.requestRender();
				}).catch(() => tui.requestRender());
			});

			return {
				dispose: () => {
					unsubscribeBranch();
					if (footerHandle === tui) footerHandle = null;
				},
				invalidate() {},
				render(width: number): string[] {
					const usage = ctx.getContextUsage();
					const contextWindow = ctx.model?.contextWindow ?? usage?.contextWindow;
					const contextLabel = usage && contextWindow ? `${Math.round(usage.percent ?? 0)}%/${formatCompactNumber(contextWindow)}` : "--";

					let inputTokens = 0;
					let outputTokens = 0;
					let cacheReadTokens = 0;
					let cacheWriteTokens = 0;
					let totalCost = 0;

					for (const entry of ctx.sessionManager.getBranch()) {
						if (entry.type === "message" && entry.message.role === "assistant") {
							const message = entry.message as AssistantMessage;
							inputTokens += message.usage?.input ?? 0;
							outputTokens += message.usage?.output ?? 0;
							cacheReadTokens += message.usage?.cacheRead ?? 0;
							cacheWriteTokens += message.usage?.cacheWrite ?? 0;
							totalCost += message.usage?.cost?.total ?? 0;
						}
					}

					const tokenSummary = formatMinimalTokenSummary({
						input: inputTokens,
						output: outputTokens,
						cacheRead: cacheReadTokens,
						cacheWrite: cacheWriteTokens,
					});
					const firstLine = buildStarshipLine({
						cwd: ctx.cwd,
						git: starshipGit,
						runtime: starshipRuntime,
						extensionStatuses: footerData.getExtensionStatuses?.(),
						contextLabel,
						tokenLabel: tokenSummary,
						costLabel: formatCurrency(totalCost),
						width,
						style: (kind, text) => {
							if (kind === "cwd") return theme.fg("accent", text);
							if (kind === "git" || kind === "runtime") return theme.fg("text", text);
							if (kind === "gitStatus") return theme.fg("warning", text);
							if (kind === "context") return theme.fg("accent", text);
							if (kind === "cost") return theme.fg("warning", text);
							if (kind === "separator" || kind === "tokens" || kind === "status" || kind === "runtimePrefix") return theme.fg("borderAccent", text);
							return theme.fg("text", text);
						},
					});

					const lines = [
						firstLine,
						renderMinimalExtraLine(theme, width, titleStatus, timerLabel, observedCaveman),
					];
					if (showSkillsStatus && loadedSkills.size > 0) {
						lines.push(...renderSkillsRows(theme, width, loadedSkills));
					}
					return lines;
				},
			};
		});
	};



	pi.events.on(PI_CAVEMAN_STATE_EVENT, (data: unknown) => {
		const normalized = normalizeObservedCavemanState(data);
		if (!normalized) return;
		observedCaveman = normalized;
		requestRender();
	});

	pi.events.on(TITLE_STATE_EVENT, (data: TitleStatus) => {
		titleStatus = data?.state ? data : { state: "idle" };
		requestRender();
	});

	pi.on("session_start", async (_event, ctx) => {
		pendingSkillReads.clear();
		titleStatus = restoreTitleStatus(ctx.sessionManager.getEntries());
		if (!ctx.hasUI) return;
		showSkillsStatus = loadMinimalSkillsConfig().enabled;
		installFooter(ctx);
	});

	pi.on("model_select", async (_event, ctx) => {
		if (!ctx.hasUI) return;
		installFooter(ctx);
	});

	pi.on("input", async (event, ctx) => {
		if (!ctx.hasUI) return;
		const match = event.text.trimStart().match(/^\/skill:([^\s]+)/);
		if (!match) return;
		setSkillStatus(match[1] ?? "", "loaded");
	});

	pi.on("tool_call", async (event, ctx) => {
		if (!ctx.hasUI) return;
		if (!isToolCallEventType("read", event)) return;

		const skillName = getSkillNameFromPath(event.input.path);
		if (!skillName) return;

		pendingSkillReads.set(event.toolCallId, skillName);
		setSkillStatus(skillName, "loading");
	});

	pi.on("before_agent_start", async (_event, ctx) => {
		if (!ctx.hasUI) return;
		stopTimer();
		timerStartedAt = Date.now();
		timerHasError = false;
		setTimerLabel("⏱");
		timerHandle = setInterval(() => setTimerLabel(timerHasError ? "✕" : "⏱"), 1000);
	});

	pi.on("tool_execution_end", async (event, ctx) => {
		if (!ctx.hasUI) return;

		const skillName = pendingSkillReads.get(event.toolCallId);
		if (skillName) {
			pendingSkillReads.delete(event.toolCallId);
			setSkillStatus(skillName, event.isError ? "error" : "loaded");
		}

		if (!event.isError) return;
		timerHasError = true;
		setTimerLabel("✕");
	});

	pi.on("after_provider_response", async (event, ctx) => {
		if (!ctx.hasUI || event.status < 400) return;
		timerHasError = true;
		setTimerLabel("✕");
	});

	pi.on("agent_end", async (_event, ctx) => {
		if (!ctx.hasUI) return;
		stopTimer();
		setTimerLabel(timerHasError ? "✕" : "✓");
	});

	pi.on("session_shutdown", async () => {
		stopTimer();
		activeCtx?.ui.setEditorComponent(undefined);
		activeCtx = undefined;
		footerHandle = null;
		pendingSkillReads.clear();
	});

	pi.registerCommand("orgm-minimal-footer", {
		description: "Reapply minimal custom footer",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) return;
			installFooter(ctx);
			ctx.ui.notify("Minimal footer applied", "success");
		},
	});

	pi.registerCommand("orgm-minimal-skills", {
		description: "Manage minimal footer skills line: on, off, toggle, clear",
		handler: async (args, ctx) => {
			if (!ctx.hasUI) return;
			const value = args.trim();
			if (!value) {
				ctx.ui.notify(`orgm-minimal-skills: ${showSkillsStatus ? "on" : "off"}`, "info");
				ctx.ui.notify(buildMinimalSkillsUsage(), "info");
				return;
			}

			const action = normalizeMinimalSkillsAction(value);
			if (!action) {
				ctx.ui.notify(`Unknown orgm-minimal-skills arg: ${value}`, "error");
				ctx.ui.notify(buildMinimalSkillsUsage(), "warning");
				return;
			}

			if (action === "clear") {
				clearTrackedSkills();
				ctx.ui.notify("Minimal footer skills cleared", "info");
				return;
			}

			if (action === "toggle") {
				setSkillsEnabled(!showSkillsStatus);
				ctx.ui.notify(`Minimal footer skills ${showSkillsStatus ? "enabled" : "disabled"}`, "success");
				return;
			}

			setSkillsEnabled(action === "on");
			ctx.ui.notify(`Minimal footer skills ${action === "on" ? "enabled" : "disabled"}`, "success");
		},
	});
}
