import { CustomEditor, type KeybindingsManager } from "@earendil-works/pi-coding-agent";
import { truncateToWidth as tuiTruncateToWidth, type EditorComponent, type EditorTheme, type TUI } from "@earendil-works/pi-tui";

const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;

type EditorComponentWithFocus = EditorComponent & {
	focused?: boolean;
	dispose?(): void;
};

export type ZentuiEditorFactory = (tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager) => EditorComponentWithFocus;

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

class SimpleTextEditor implements EditorComponentWithFocus {
	focused = false;
	onSubmit?: (text: string) => void;
	onChange?: (text: string) => void;
	private text = "";

	render(width: number): string[] {
		return [truncateToWidth(this.text, width)];
	}

	handleInput(data: string): void {
		if (data === "\u007f" || data === "\b") {
			this.setText(Array.from(this.text).slice(0, -1).join(""));
			return;
		}
		if (data === "\r" || data === "\n") {
			this.onSubmit?.(this.text);
			return;
		}
		if (data.length === 1 && data >= " ") this.setText(`${this.text}${data}`);
	}

	getText(): string {
		return this.text;
	}

	setText(text: string): void {
		this.text = text;
		this.onChange?.(text);
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
	return level || "off";
}

export function composeEditorMetaLine(input: EditorMetaInput): string {
	const text = `${input.modelLabel} · ${input.providerLabel} · ${input.thinkingLabel}`;
	return input.style("text", truncateToWidth(text, input.width));
}

function fillLine(content: string, width: number): string {
	const clipped = truncateToWidth(content, width);
	return `${clipped}${" ".repeat(Math.max(0, width - visibleWidth(clipped)))}`;
}

function colorText(theme: EditorTheme, kind: EditorMetaStyleKind, text: string): string {
	const maybePiTheme = theme as EditorTheme & { fg?: (kind: string, text: string) => string };
	if (maybePiTheme.fg) {
		return maybePiTheme.fg(kind === "text" ? "accent" : "borderMuted", text);
	}
	return text;
}

function backgroundText(theme: EditorTheme, text: string): string {
	const maybePiTheme = theme as EditorTheme & { bg?: (kind: string, text: string) => string };
	if (maybePiTheme.bg) return maybePiTheme.bg("customMessageBg", text);
	return text;
}

function isHorizontalEditorBorder(line: string): boolean {
	const plain = line.replace(ANSI_PATTERN, "").trim();
	return plain.length > 0 && /^[─━\-╭╮╰╯┌┐└┘]+$/.test(plain);
}

function createDefaultEditor(tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager): EditorComponentWithFocus {
	try {
		return new CustomEditor(tui, theme, keybindings) as EditorComponentWithFocus;
	} catch {
		return new SimpleTextEditor();
	}
}

export class ZentuiEditorFrame implements EditorComponentWithFocus {
	private readonly base: EditorComponentWithFocus;
	private readonly theme: EditorTheme;
	private readonly getMeta: ZentuiEditorMetaGetter;
	private storedBorderColor?: (text: string) => string;

	constructor(base: EditorComponentWithFocus, theme: EditorTheme, getMeta: ZentuiEditorMetaGetter) {
		this.base = base;
		this.theme = theme;
		this.getMeta = getMeta;
	}

	get focused(): boolean {
		return this.base.focused ?? false;
	}

	set focused(value: boolean) {
		this.base.focused = value;
	}

	get onSubmit(): ((text: string) => void) | undefined {
		return this.base.onSubmit;
	}

	set onSubmit(handler: ((text: string) => void) | undefined) {
		this.base.onSubmit = handler;
	}

	get onChange(): ((text: string) => void) | undefined {
		return this.base.onChange;
	}

	set onChange(handler: ((text: string) => void) | undefined) {
		this.base.onChange = handler;
	}

	get borderColor(): ((str: string) => string) | undefined {
		return this.base.borderColor ?? this.storedBorderColor ?? this.theme.borderColor;
	}

	set borderColor(color: ((str: string) => string) | undefined) {
		this.storedBorderColor = color;
		this.base.borderColor = color;
	}

	render(width: number): string[] {
		const contentWidth = Math.max(1, width - 2);
		const rail = colorText(this.theme, "border", "|");
		const baseLines = this.base
			.render(contentWidth)
			.filter((line) => !isHorizontalEditorBorder(line))
			.map((line) => tuiTruncateToWidth(line, contentWidth, ""));
		const body = baseLines.length > 0 ? baseLines : [""];
		const meta = composeEditorMetaLine({
			...this.getMeta(),
			width: contentWidth,
			style: (kind, text) => colorText(this.theme, kind, text),
		});
		const rows = [...body, meta];
		return rows.map((line) => {
			const content = backgroundText(this.theme, fillLine(line, contentWidth));
			return tuiTruncateToWidth(`${rail} ${content}`, width, "");
		});
	}

	handleInput(data: string): void {
		this.base.handleInput(data);
	}

	getText(): string {
		return this.base.getText();
	}

	setText(text: string): void {
		this.base.setText(text);
	}

	addToHistory(text: string): void {
		this.base.addToHistory?.(text);
	}

	insertTextAtCursor(text: string): void {
		this.base.insertTextAtCursor?.(text);
	}

	getExpandedText(): string {
		return this.base.getExpandedText?.() ?? this.base.getText();
	}

	setAutocompleteProvider(provider: Parameters<NonNullable<EditorComponent["setAutocompleteProvider"]>>[0]): void {
		this.base.setAutocompleteProvider?.(provider);
	}

	setPaddingX(padding: number): void {
		this.base.setPaddingX?.(padding);
	}

	setAutocompleteMaxVisible(maxVisible: number): void {
		this.base.setAutocompleteMaxVisible?.(maxVisible);
	}

	dispose(): void {
		this.base.dispose?.();
	}
}

function isPrototypeMethod(object: object, property: string | symbol): boolean {
	let prototype = Object.getPrototypeOf(object);
	while (prototype && prototype !== Object.prototype) {
		const descriptor = Object.getOwnPropertyDescriptor(prototype, property);
		if (typeof descriptor?.value === "function") return true;
		prototype = Object.getPrototypeOf(prototype);
	}
	return false;
}

function createDelegatingEditorFrame(base: EditorComponentWithFocus, frame: ZentuiEditorFrame): EditorComponentWithFocus {
	const baseRecord = base as Record<PropertyKey, unknown>;
	return new Proxy(frame, {
		get(target, property, receiver) {
			if (property in target) return Reflect.get(target, property, receiver);
			const value = Reflect.get(baseRecord, property, baseRecord);
			return typeof value === "function" && isPrototypeMethod(base, property) ? value.bind(base) : value;
		},
		set(target, property, value, receiver) {
			if (property in target) return Reflect.set(target, property, value, receiver);
			return Reflect.set(baseRecord, property, value, baseRecord);
		},
		has(target, property) {
			return property in target || property in baseRecord;
		},
		getOwnPropertyDescriptor(target, property) {
			const targetDescriptor = Reflect.getOwnPropertyDescriptor(target, property);
			if (targetDescriptor) return targetDescriptor;
			const baseDescriptor = Reflect.getOwnPropertyDescriptor(baseRecord, property);
			return baseDescriptor ? { ...baseDescriptor, configurable: true } : undefined;
		},
	}) as EditorComponentWithFocus;
}

export function createZentuiEditorFactory(getMeta: ZentuiEditorMetaGetter, previous?: ZentuiEditorFactory): ZentuiEditorFactory {
	return (tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager) => {
		const base = previous ? previous(tui, theme, keybindings) : createDefaultEditor(tui, theme, keybindings);
		return createDelegatingEditorFrame(base, new ZentuiEditorFrame(base, theme, getMeta));
	};
}
