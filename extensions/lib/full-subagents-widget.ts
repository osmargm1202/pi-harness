import { createRequire } from "node:module";
import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import type { FullSubagentSnapshot, FullSubagentState } from "./full-subagents-com.ts";

const require = createRequire(import.meta.url);
const { truncateToWidth } = loadPiTui();

function fallbackTruncateToWidth(text: string, width: number): string {
	if (width <= 0) return "";
	const chars = Array.from(text);
	return chars.length <= width ? text : chars.slice(0, width).join("");
}

function loadPiTui(): { truncateToWidth: (text: string, width: number) => string } {
	try {
		return require("@earendil-works/pi-tui") as { truncateToWidth: (text: string, width: number) => string };
	} catch {
		return { truncateToWidth: fallbackTruncateToWidth };
	}
}

export interface FullSubagentsWidgetOptions {
	color: boolean;
	showModel: boolean;
	showContext: boolean;
	showCompact: boolean;
}

export const FULL_SUBAGENTS_WIDGET_KEY = "full-subagents";

function stateSymbol(state: FullSubagentState): string {
	if (state === "busy" || state === "compacting") return "◉";
	if (state === "idle") return "●";
	if (state === "dead") return "×";
	if (state === "error") return "!";
	return "○";
}

function stateColor(state: FullSubagentState): "warning" | "success" | "error" | "muted" {
	if (state === "busy" || state === "compacting") return "warning";
	if (state === "idle") return "success";
	if (state === "dead" || state === "error") return "error";
	return "muted";
}

function renderAgentLine(snapshot: FullSubagentSnapshot, options: FullSubagentsWidgetOptions): string {
	const parts = [
		`${stateSymbol(snapshot.state)} ${snapshot.agentName}`,
		snapshot.state,
		options.showModel ? snapshot.model : undefined,
		options.showContext ? `ctx ${snapshot.contextPercent}%` : undefined,
		options.showCompact ? `compact ${snapshot.compactCount}` : undefined,
		snapshot.activity,
		snapshot.lastError ? `error ${snapshot.lastError}` : undefined,
	].filter((part): part is string => Boolean(part));
	return parts.join(" · ");
}

export function renderFullSubagentsWidgetLines(
	snapshots: FullSubagentSnapshot[],
	width: number,
	options: FullSubagentsWidgetOptions,
): string[] {
	if (snapshots.length === 0) return [];
	const busy = snapshots.filter((snapshot) => snapshot.state === "busy" || snapshot.state === "compacting").length;
	const down = snapshots.filter((snapshot) => snapshot.state === "dead" || snapshot.state === "error").length;
	const idle = snapshots.length - busy - down;
	const header = `Full subagents · ${busy} busy · ${idle} idle · ${down} down`;
	return [
		truncateToWidth(header, width),
		...snapshots.map((snapshot) => truncateToWidth(renderAgentLine(snapshot, options), width)),
	];
}

export function installFullSubagentsWidget(
	ctx: ExtensionContext,
	getSnapshots: () => FullSubagentSnapshot[],
	options: Omit<FullSubagentsWidgetOptions, "color">,
): void {
	if (!ctx.hasUI) return;
	ctx.ui.setWidget(FULL_SUBAGENTS_WIDGET_KEY, (_tui, theme: Theme) => ({
		invalidate() {},
		render(width: number): string[] {
			const snapshots = getSnapshots();
			const lines = renderFullSubagentsWidgetLines(snapshots, width, { ...options, color: true });
			return lines.map((line, index) => {
				if (index === 0) return theme.fg("accent", line);
				return theme.fg(stateColor(snapshots[index - 1]?.state ?? "starting"), line);
			});
		},
	}));
}

export function clearFullSubagentsWidget(ctx: ExtensionContext): void {
	if (!ctx.hasUI) return;
	ctx.ui.setWidget(FULL_SUBAGENTS_WIDGET_KEY, undefined);
}
