import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
	composeEditorMetaLine,
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

const source = readFileSync(new URL("../extensions/lib/zentui-editor.ts", import.meta.url), "utf8");
assert(source.includes("CustomEditor"), "zentui editor helper should wrap Pi CustomEditor");
assert(source.includes("createZentuiEditorFactory"), "zentui editor helper should expose factory creator");
