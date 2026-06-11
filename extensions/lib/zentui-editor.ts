import { createRequire } from "node:module";
import type { KeybindingsManager, Theme } from "@earendil-works/pi-coding-agent";

const require = createRequire(import.meta.url);
const { CustomEditor } = loadPiCodingAgent();
const { truncateToWidth: tuiTruncateToWidth } = loadPiTui();

const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;

type CustomEditorConstructor = new (theme: Theme, keybindings: KeybindingsManager) => {
	render(width: number): string[];
};

export type EditorMetaStyleKind = "border" | "model" | "provider" | "thinking" | "text";

export type EditorMetaInput = {
	modelLabel: string;
	providerLabel: string;
	thinkingLabel: string;
	width: number;
	style: (kind: EditorMetaStyleKind, text: string) => string;
};

export type ZentuiEditorMetaGetter = () => {
	modelLabel: string;
	providerLabel: string;
	thinkingLabel: string;
};

function loadPiCodingAgent(): { CustomEditor: CustomEditorConstructor } {
	try {
		return require("@earendil-works/pi-coding-agent") as { CustomEditor: CustomEditorConstructor };
	} catch {
		return {
			CustomEditor: class CustomEditorFallback {
				constructor(_theme: Theme, _keybindings: KeybindingsManager) {}
				render(_width: number): string[] {
					return [""];
				}
			} as CustomEditorConstructor,
		};
	}
}

function fallbackTuiTruncateToWidth(text: string, width: number, _suffix = "…"): string {
	return truncateToWidth(text, width);
}

function loadPiTui(): { truncateToWidth: (text: string, width: number, suffix?: string) => string } {
	try {
		return require("@earendil-works/pi-tui") as { truncateToWidth: (text: string, width: number, suffix?: string) => string };
	} catch {
		return { truncateToWidth: fallbackTuiTruncateToWidth };
	}
}

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

export function formatProviderLabel(provider: string | undefined): string {
	if (!provider) return "Unknown";
	const known: Record<string, string> = {
		anthropic: "Anthropic",
		gemini: "Google",
		google: "Google",
		ollama: "Ollama",
		openai: "OpenAI",
		"openai-codex": "OpenAI",
	};
	return known[provider] ?? provider.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatThinkingLabel(level: string | undefined): string {
	return `thinking ${level || "off"}`;
}

export function composeEditorMetaLine(input: EditorMetaInput): string {
	const text = `${input.modelLabel} · ${input.providerLabel} · ${input.thinkingLabel}`;
	return input.style("text", truncateToWidth(text, input.width));
}

function fillLine(content: string, width: number): string {
	const clipped = truncateToWidth(content, width);
	return `${clipped}${" ".repeat(Math.max(0, width - visibleWidth(clipped)))}`;
}

export class ZentuiEditor extends CustomEditor {
	private readonly theme: Theme;
	private readonly getMeta: ZentuiEditorMetaGetter;

	constructor(theme: Theme, keybindings: KeybindingsManager, getMeta: ZentuiEditorMetaGetter) {
		super(theme, keybindings);
		this.theme = theme;
		this.getMeta = getMeta;
	}

	render(width: number): string[] {
		const innerWidth = Math.max(1, width - 2);
		const baseLines = super.render(innerWidth).map((line) => tuiTruncateToWidth(line, innerWidth, ""));
		const meta = composeEditorMetaLine({
			...this.getMeta(),
			width: Math.max(1, innerWidth - 2),
			style: (kind, text) => {
				if (kind === "text") return this.theme.fg("accent", text);
				return text;
			},
		});
		const topLabel = ` ${meta} `;
		const topRest = "─".repeat(Math.max(0, innerWidth - visibleWidth(topLabel)));
		const top = this.theme.fg("borderMuted", `╭${topRest}`) + topLabel + this.theme.fg("borderMuted", "╮");
		const body = baseLines.length > 0 ? baseLines : [""];
		const boxedBody = body.map((line) => this.theme.fg("borderMuted", "│") + fillLine(line, innerWidth) + this.theme.fg("borderMuted", "│"));
		const bottom = this.theme.fg("borderMuted", `╰${"─".repeat(innerWidth)}╯`);
		return [top, ...boxedBody, bottom].map((line) => tuiTruncateToWidth(line, width, ""));
	}
}

export function createZentuiEditorFactory(getMeta: ZentuiEditorMetaGetter) {
	return (_tui: unknown, theme: Theme, keybindings: KeybindingsManager) => new ZentuiEditor(theme, keybindings, getMeta);
}
