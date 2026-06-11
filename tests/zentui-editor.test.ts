import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	composeEditorMetaLine,
	createZentuiEditorFactory,
	formatProviderLabel,
	formatThinkingLabel,
	visibleWidth,
} from "../extensions/lib/zentui-editor.ts";

assert.equal(formatProviderLabel("openai-codex"), "OpenAI", "OpenAI Codex provider should display as OpenAI");
assert.equal(formatProviderLabel("anthropic"), "Anthropic", "Anthropic provider should display nicely");
assert.equal(formatProviderLabel("minimax-cn"), "Minimax Cn", "unknown providers should title-case words");
assert.equal(formatProviderLabel(undefined), "Unknown", "missing provider should display Unknown");

assert.equal(formatThinkingLabel("off"), "thinking off", "off thinking should be explicit");
assert.equal(formatThinkingLabel("xhigh"), "thinking xhigh", "xhigh thinking should display level");

const meta = composeEditorMetaLine({
	modelLabel: "gpt-5.3-codex",
	providerLabel: "OpenAI",
	thinkingLabel: "thinking high",
	width: 80,
	style: (_kind, text) => text,
});
assert(meta.includes("gpt-5.3-codex"), "meta should include model");
assert(meta.includes("OpenAI"), "meta should include provider");
assert(meta.includes("thinking high"), "meta should include thinking");
assert(visibleWidth(meta) <= 80, "meta should fit width");

const narrow = composeEditorMetaLine({
	modelLabel: "very-long-model-name-that-does-not-fit",
	providerLabel: "OpenAI",
	thinkingLabel: "thinking xhigh",
	width: 24,
	style: (_kind, text) => text,
});
assert(visibleWidth(narrow) <= 24, "narrow meta should fit width");
assert(narrow.endsWith("…") || visibleWidth(narrow) < 24, "narrow meta should truncate gracefully");

const calls: unknown[][] = [];
const baseEditor = {
	focused: false,
	onSubmit: undefined as ((text: string) => void) | undefined,
	onChange: undefined as ((text: string) => void) | undefined,
	actionHandlers: undefined as unknown,
	onEscape: undefined as unknown,
	onCtrlD: "base ctrl-d handler" as unknown,
	borderColor: (text: string) => text,
	render(width: number): string[] {
		calls.push(["render", width]);
		return ["base input"];
	},
	handleInput(data: string): void {
		calls.push(["handleInput", data]);
	},
	getText(): string {
		calls.push(["getText"]);
		return "typed text";
	},
	setText(text: string): void {
		calls.push(["setText", text]);
	},
	addToHistory(text: string): void {
		calls.push(["addToHistory", text]);
	},
	insertTextAtCursor(text: string): void {
		calls.push(["insertTextAtCursor", text]);
	},
	getExpandedText(): string {
		calls.push(["getExpandedText"]);
		return "expanded text";
	},
	setAutocompleteProvider(provider: unknown): void {
		calls.push(["setAutocompleteProvider", provider]);
	},
	setPaddingX(padding: number): void {
		calls.push(["setPaddingX", padding]);
	},
	setAutocompleteMaxVisible(maxVisible: number): void {
		calls.push(["setAutocompleteMaxVisible", maxVisible]);
	},
};
const previousArgs: unknown[][] = [];
const previousFactory = (...args: unknown[]) => {
	previousArgs.push(args);
	return baseEditor;
};
const tui = { id: "tui", terminal: { rows: 24, cols: 80 }, requestRender() {} };
const editorTheme = { borderColor: (text: string) => text, selectList: {} };
const keybindings = { id: "keybindings", matches: () => false };
const wrapped = createZentuiEditorFactory(
	() => ({ modelLabel: "gpt-5", providerLabel: "OpenAI", thinkingLabel: "thinking high" }),
	previousFactory,
)(tui as never, editorTheme as never, keybindings as never);

assert.equal(previousArgs.length, 1, "zentui factory should create the previous editor when provided");
assert.deepEqual(previousArgs[0], [tui, editorTheme, keybindings], "previous editor factory should receive original Pi factory args");
assert.notEqual(wrapped, baseEditor, "zentui factory should wrap the previous editor component");

const rendered = wrapped.render(20);
assert.deepEqual(calls.shift(), ["render", 18], "wrapper should render base editor with inner width");
assert(rendered.some((line) => line.includes("base input")), "wrapper should render base editor output inside frame");
assert(rendered[0]?.includes("gpt-5"), "wrapper should render meta line in frame");

wrapped.handleInput("x");
assert.deepEqual(calls.shift(), ["handleInput", "x"], "wrapper should delegate handleInput to base editor");
assert.equal(wrapped.getText(), "typed text", "wrapper should delegate getText to base editor");
assert.deepEqual(calls.shift(), ["getText"], "wrapper should call base getText");
wrapped.setText("new text");
assert.deepEqual(calls.shift(), ["setText", "new text"], "wrapper should delegate setText to base editor");
wrapped.addToHistory?.("sent");
assert.deepEqual(calls.shift(), ["addToHistory", "sent"], "wrapper should delegate addToHistory to base editor");
wrapped.insertTextAtCursor?.("inserted");
assert.deepEqual(calls.shift(), ["insertTextAtCursor", "inserted"], "wrapper should delegate cursor insertion to base editor");
assert.equal(wrapped.getExpandedText?.(), "expanded text", "wrapper should delegate expanded text to base editor");
assert.deepEqual(calls.shift(), ["getExpandedText"], "wrapper should call base getExpandedText");
const provider = { complete: true };
wrapped.setAutocompleteProvider?.(provider as never);
assert.deepEqual(calls.shift(), ["setAutocompleteProvider", provider], "wrapper should delegate autocomplete provider to base editor");
wrapped.setPaddingX?.(3);
assert.deepEqual(calls.shift(), ["setPaddingX", 3], "wrapper should delegate padding to base editor");
wrapped.setAutocompleteMaxVisible?.(7);
assert.deepEqual(calls.shift(), ["setAutocompleteMaxVisible", 7], "wrapper should delegate autocomplete max visible to base editor");

const onSubmit = () => {};
const onChange = () => {};
wrapped.onSubmit = onSubmit;
wrapped.onChange = onChange;
assert.equal(baseEditor.onSubmit, onSubmit, "wrapper should delegate onSubmit property to base editor");
assert.equal(baseEditor.onChange, onChange, "wrapper should delegate onChange property to base editor");
const actionHandlers = { submit: () => {} };
const onEscape = () => {};
(wrapped as { actionHandlers?: unknown }).actionHandlers = actionHandlers;
(wrapped as { onEscape?: unknown }).onEscape = onEscape;
assert.equal(baseEditor.actionHandlers, actionHandlers, "wrapper should store unknown actionHandlers property on base editor");
assert.equal(baseEditor.onEscape, onEscape, "wrapper should store unknown onEscape property on base editor");
assert.equal((wrapped as { actionHandlers?: unknown }).actionHandlers, actionHandlers, "wrapper should read unknown actionHandlers property from base editor");
assert.equal((wrapped as { onCtrlD?: unknown }).onCtrlD, baseEditor.onCtrlD, "wrapper should read unknown handler properties from base editor");
wrapped.focused = true;
assert.equal(baseEditor.focused, true, "wrapper should delegate focus state to base editor");

const fallbackWrapped = createZentuiEditorFactory(() => ({
	modelLabel: "fallback",
	providerLabel: "Unknown",
	thinkingLabel: "thinking off",
}))(tui as never, editorTheme as never, keybindings as never);
assert.equal(typeof fallbackWrapped.handleInput, "function", "fallback editor should expose handleInput");
fallbackWrapped.handleInput("a");
assert.equal(fallbackWrapped.getText(), "a", "fallback editor should accept typed input when no previous editor is installed");
assert(Array.isArray(fallbackWrapped.render(10)), "fallback editor should render safely");

const source = readFileSync(new URL("../extensions/lib/zentui-editor.ts", import.meta.url), "utf8");
assert(source.includes("CustomEditor"), "zentui editor helper should use Pi CustomEditor only for safe fallback construction");
assert(!source.includes("extends CustomEditor"), "zentui editor helper should compose instead of extending CustomEditor");
assert(!source.includes("new CustomEditor(theme, keybindings"), "zentui editor helper should not use the old unsafe CustomEditor constructor signature");
assert(source.includes("createZentuiEditorFactory"), "zentui editor helper should expose factory creator");
