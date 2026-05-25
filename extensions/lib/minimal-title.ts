export const SESSION_TITLE_ENTRY_TYPE = "session-title";
export const TITLE_STATE_EVENT = "title:state-changed";
export const MAX_TITLE_WIDTH = 80;

const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;

export function visibleWidth(text: string): number {
	return Array.from(text.replace(ANSI_PATTERN, "")).length;
}

export function truncateToWidth(text: string, width: number): string {
	if (width <= 0) return "";
	if (visibleWidth(text) <= width) return text;
	const chars = Array.from(text.replace(ANSI_PATTERN, ""));
	if (width === 1) return "…";
	return `${chars.slice(0, width - 1).join("")}…`;
}

export const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;

export type TitleStatus =
	| { state: "idle"; title?: string }
	| { state: "generating"; title?: string; frame?: string }
	| { state: "ready"; title: string }
	| { state: "error"; title?: string; error?: string };

export type TitleCommand =
	| { action: "show" }
	| { action: "regen" }
	| { action: "name"; title: string }
	| { action: "clear" }
	| { action: "unknown"; message: string };

export function sanitizeTitle(input: string, maxWidth = MAX_TITLE_WIDTH): string {
	const normalized = input
		.replace(/[\r\n\t]+/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
		.trim();
	if (!normalized) return "";
	return truncateToWidth(normalized, maxWidth);
}

export function parseTitleCommand(args: string): TitleCommand {
	const trimmed = args.trim();
	if (!trimmed) return { action: "show" };
	const [rawAction = "", ...rest] = trimmed.split(/\s+/);
	const action = rawAction.toLowerCase();
	if (action === "regen" || action === "regenerate") return { action: "regen" };
	if (action === "clear" || action === "reset") return { action: "clear" };
	if (action === "name" || action === "set") {
		const title = sanitizeTitle(rest.join(" "));
		if (!title) return { action: "unknown", message: "Usage: /title name <nombre del título>" };
		return { action: "name", title };
	}
	return { action: "unknown", message: "Usage: /title [regen|name <título>|clear]" };
}

export function padToWidth(text: string, width: number): string {
	const clipped = truncateToWidth(text, Math.max(0, width));
	return clipped + " ".repeat(Math.max(0, width - visibleWidth(clipped)));
}

export function centerToWidth(text: string, width: number): string {
	if (width <= 0) return "";
	const clipped = truncateToWidth(text, width);
	const left = Math.max(0, Math.floor((width - visibleWidth(clipped)) / 2));
	return padToWidth(`${" ".repeat(left)}${clipped}`, width);
}

export function renderTitleLine(
	status: TitleStatus,
	width: number,
	style: (kind: "accent" | "dim" | "warning" | "error", text: string) => string,
): string {
	if (width <= 0) return "";
	if (status.state === "generating") {
		return centerToWidth(style("warning", `${status.frame ?? SPINNER_FRAMES[0]} Generando título…`), width);
	}
	if (status.state === "error") {
		const fallback = status.title ? `⚠ ${status.title} · /title regen` : "⚠ Error generando título · /title regen";
		const text = visibleWidth(fallback) > width && width >= 14 ? "⚠ /title regen" : fallback;
		return centerToWidth(style("error", text), width);
	}
	if (status.state === "ready") {
		return centerToWidth(style("accent", status.title), width);
	}
	if (status.title) return centerToWidth(style("dim", status.title), width);
	return "".padEnd(width);
}
