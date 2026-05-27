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

export type FullSubagentsWidgetLayout = "minimal" | "full";

export interface FullSubagentsWidgetOptions {
	color: boolean;
	showModel: boolean;
	showContext: boolean;
	showCompact: boolean;
	layout: FullSubagentsWidgetLayout;
	now?: number;
}

export const FULL_SUBAGENTS_WIDGET_KEY = "full-subagents";

function stateColor(state: FullSubagentState): "accent" | "error" | "muted" {
	if (state === "busy" || state === "compacting") return "accent";
	if (state === "dead" || state === "error") return "error";
	return "muted";
}

function rowColor(snapshots: FullSubagentSnapshot[]): "accent" | "error" | "muted" {
	if (snapshots.some((snapshot) => snapshot.state === "dead" || snapshot.state === "error")) return "error";
	if (snapshots.some((snapshot) => snapshot.state === "busy" || snapshot.state === "compacting")) return "accent";
	return "muted";
}

function shortStatus(snapshot: FullSubagentSnapshot): string {
	if (snapshot.state === "dead") return "dead";
	if (snapshot.state === "error") return "err";
	if (snapshot.state === "awaiting_user") return snapshot.lastResult ? "done-await" : "await";
	if (snapshot.state === "busy" || snapshot.state === "compacting") return "work";
	if (snapshot.state === "idle") return snapshot.lastResult ? "done-idle" : "idle";
	return "start";
}

function formatBar(percent: number): string {
	const filled = Math.max(0, Math.min(10, Math.round(percent / 10)));
	return `[${"#".repeat(filled)}${"-".repeat(10 - filled)}]`;
}

function padCell(text: string, width: number): string {
	const truncated = truncateToWidth(text, width);
	return truncated + " ".repeat(Math.max(0, width - truncated.length));
}

function formatElapsed(ms: number): string {
	const seconds = Math.max(0, Math.floor(ms / 1000));
	const minutes = Math.floor(seconds / 60);
	const remainder = seconds % 60;
	return minutes > 0 ? `T+${minutes}m${remainder}s` : `T+${remainder}s`;
}

function elapsedPart(snapshot: FullSubagentSnapshot, options: FullSubagentsWidgetOptions): string | undefined {
	if (!snapshot.activeSince) return undefined;
	return formatElapsed((options.now ?? Date.now()) - snapshot.activeSince);
}

function renderMinimalAgentCell(snapshot: FullSubagentSnapshot, options: FullSubagentsWidgetOptions, width: number): string {
	const parts = [
		snapshot.agentName,
		shortStatus(snapshot),
		elapsedPart(snapshot, options),
		options.showContext ? `${formatBar(snapshot.contextPercent)} ${snapshot.contextPercent}%` : undefined,
		options.showCompact ? `C-${snapshot.compactCount}` : undefined,
	].filter((part): part is string => Boolean(part));
	return `| ${padCell(parts.join(" "), Math.max(1, width - 4))} |`;
}

function renderFullAgentCard(snapshot: FullSubagentSnapshot, options: FullSubagentsWidgetOptions, width: number): string[] {
	const innerWidth = Math.max(8, width - 2);
	const title = ` ${truncateToWidth(snapshot.agentName, Math.max(1, innerWidth - 2))} `;
	const titleFill = "─".repeat(Math.max(0, innerWidth - title.length));
	const lines = [
		`╭${title}${titleFill}╮`,
		`│${padCell(` ${shortStatus(snapshot)}`, innerWidth)}│`,
	];
	if (options.showModel && snapshot.model) lines.push(`│${padCell(` ${snapshot.model}`, innerWidth)}│`);
	lines.push(`│${padCell(` ${formatBar(snapshot.contextPercent)} ${snapshot.contextPercent}% C-${snapshot.compactCount}${elapsedPart(snapshot, options) ? ` ${elapsedPart(snapshot, options)}` : ""}`, innerWidth)}│`);
	if (snapshot.lastError) lines.push(`│${padCell(` ${snapshot.lastError}`, innerWidth)}│`);
	else if (snapshot.activity) lines.push(`│${padCell(` ${snapshot.activity}`, innerWidth)}│`);
	lines.push(`╰${"─".repeat(innerWidth)}╯`);
	return lines.map((line) => truncateToWidth(line, width));
}

const MINIMAL_CELL_WIDTH = 50;
const MINIMAL_GAP = " ";

function minimalColumnCount(width: number, count: number): number {
	return Math.max(1, Math.min(3, Math.floor((width + MINIMAL_GAP.length) / (MINIMAL_CELL_WIDTH + MINIMAL_GAP.length)) || 1, count));
}

function minimalCellWidth(width: number, columns: number): number {
	const available = Math.floor((width - MINIMAL_GAP.length * Math.max(0, columns - 1)) / columns);
	return width < MINIMAL_CELL_WIDTH ? Math.max(1, available) : Math.max(MINIMAL_CELL_WIDTH, available);
}

function renderMinimalWidgetLines(snapshots: FullSubagentSnapshot[], width: number, options: FullSubagentsWidgetOptions): string[] {
	const columns = minimalColumnCount(width, snapshots.length);
	const cellWidth = minimalCellWidth(width, columns);
	const lines: string[] = [];
	for (let index = 0; index < snapshots.length; index += columns) {
		lines.push(truncateToWidth(snapshots.slice(index, index + columns).map((snapshot) => renderMinimalAgentCell(snapshot, options, cellWidth)).join(MINIMAL_GAP), width));
	}
	return lines;
}

function renderFullWidgetLines(snapshots: FullSubagentSnapshot[], width: number, options: FullSubagentsWidgetOptions): string[] {
	const cardWidth = 34;
	const gap = "  ";
	const columns = Math.max(1, Math.min(3, Math.floor((width + gap.length) / (cardWidth + gap.length)) || 1, snapshots.length));
	const cards = snapshots.map((snapshot) => renderFullAgentCard(snapshot, options, cardWidth));
	const lines: string[] = [];
	for (let index = 0; index < cards.length; index += columns) {
		const row = cards.slice(index, index + columns);
		const height = Math.max(...row.map((card) => card.length));
		for (let lineIndex = 0; lineIndex < height; lineIndex += 1) {
			lines.push(truncateToWidth(row.map((card) => card[lineIndex] ?? " ".repeat(cardWidth)).join(gap), width));
		}
		if (index + columns < cards.length) lines.push("");
	}
	return lines;
}

export function renderFullSubagentsWidgetLines(
	snapshots: FullSubagentSnapshot[],
	width: number,
	options: FullSubagentsWidgetOptions,
): string[] {
	if (snapshots.length === 0) return [];
	const busy = snapshots.filter((snapshot) => snapshot.state === "busy" || snapshot.state === "compacting").length;
	const awaiting = snapshots.filter((snapshot) => snapshot.state === "awaiting_user").length;
	const down = snapshots.filter((snapshot) => snapshot.state === "dead" || snapshot.state === "error").length;
	const idle = snapshots.length - busy - awaiting - down;
	const header = `Full subagents · W${busy} I${idle} A${awaiting} D${down}`;
	return [
		truncateToWidth(header, width),
		...(options.layout === "full" ? renderFullWidgetLines(snapshots, width, options) : renderMinimalWidgetLines(snapshots, width, options)),
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
			if (options.layout === "full") {
				const columns = Math.max(1, Math.min(3, Math.floor((width + 2) / 36) || 1, snapshots.length));
				let snapshotRow = 0;
				return lines.map((line, index) => {
					if (index === 0) return theme.fg("accent", line);
					if (!line) {
						snapshotRow += columns;
						return line;
					}
					return theme.fg(rowColor(snapshots.slice(snapshotRow, snapshotRow + columns)), line);
				});
			}
			const columns = minimalColumnCount(width, snapshots.length);
			const cellWidth = minimalCellWidth(width, columns);
			const rendered = [theme.fg("accent", lines[0] ?? "")];
			for (let index = 0; index < snapshots.length; index += columns) {
				const row = snapshots.slice(index, index + columns)
					.map((snapshot) => theme.fg(stateColor(snapshot.state), renderMinimalAgentCell(snapshot, { ...options, color: true }, cellWidth)))
					.join(MINIMAL_GAP);
				rendered.push(truncateToWidth(row, width));
			}
			return rendered;
		},
	}));
}

export function clearFullSubagentsWidget(ctx: ExtensionContext): void {
	if (!ctx.hasUI) return;
	ctx.ui.setWidget(FULL_SUBAGENTS_WIDGET_KEY, undefined);
}
