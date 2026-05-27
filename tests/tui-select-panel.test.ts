import assert from "node:assert/strict";
import { createSelectListTheme, createSelectPanel } from "../extensions/lib/tui-select-panel.ts";

const theme = {
	fg: (_kind: string, text: string) => text,
	bold: (text: string) => text,
} as any;

const { container, selectList } = createSelectPanel({
	theme,
	title: "Project Sessions",
	subtitle: "Newest first · 2 sessions",
	help: "↑↓ navigate • enter recover/open • esc cancel",
	items: [
		{ value: "one", label: "Session One", description: "first" },
		{ value: "two", label: "Session Two", description: "second" },
	],
	maxHeight: 12,
});

assert(selectList, "createSelectPanel should return the SelectList for caller wiring");

const rendered = container.render(80).join("\n");
assert(rendered.includes("Project Sessions"), "panel should render title");
assert(rendered.includes("Newest first · 2 sessions"), "panel should render subtitle");
assert(rendered.includes("Session One"), "panel should render select item labels");
assert(rendered.includes("↑↓ navigate • enter recover/open • esc cancel"), "panel should render help text");

const calls: Array<[string, string]> = [];
const callbackTheme = {
	fg: (kind: string, text: string) => {
		calls.push([kind, text]);
		return `${kind}:${text}`;
	},
	bold: (text: string) => text,
} as any;

const callbacks = createSelectListTheme(callbackTheme);
assert.equal(callbacks.selectedPrefix(">"), "accent:>");
assert.equal(callbacks.selectedText("Selected"), "accent:Selected");
assert.equal(callbacks.description("Description"), "muted:Description");
assert.equal(callbacks.scrollInfo("1/2"), "dim:1/2");
assert.equal(callbacks.noMatch("No match"), "warning:No match");
assert.deepEqual(calls, [
	["accent", ">"],
	["accent", "Selected"],
	["muted", "Description"],
	["dim", "1/2"],
	["warning", "No match"],
]);
