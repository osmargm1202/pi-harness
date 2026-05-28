import assert from "node:assert/strict";
import specDisExtension from "../extensions/spec-dis.ts";

type Handler = (event: any, ctx: any) => unknown | Promise<unknown>;

function createHarness() {
	const handlers = new Map<string, Handler>();
	const commands = new Map<string, { description: string; handler: Function }>();
	const shortcuts = new Map<string, { description: string; handler: Function }>();
	const pi = {
		on(event: string, handler: Handler) {
			handlers.set(event, handler);
		},
		registerCommand(name: string, command: { description: string; handler: Function }) {
			commands.set(name, command);
		},
		registerShortcut(shortcut: string, definition: { description: string; handler: Function }) {
			shortcuts.set(shortcut, definition);
		},
	};

	specDisExtension(pi as never);
	return { handlers, commands, shortcuts };
}

const harness = createHarness();

assert(harness.commands.has("orgm-spec-dis"), "manual /orgm-spec-dis command should stay registered");
assert(harness.shortcuts.has("alt+4"), "manual alt+4 shortcut should stay registered");
assert.equal(harness.handlers.size, 0, "spec-dis should not register lifecycle hooks in manual-only mode");
