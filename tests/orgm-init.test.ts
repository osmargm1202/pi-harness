import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import orgmExtension from "../extensions/orgm.ts";

type Handler = (args: string, ctx: any) => unknown | Promise<unknown>;

const tempDir = mkdtempSync(join(tmpdir(), "orgm-init-"));
const previousHome = process.env.HOME;
process.env.HOME = tempDir;

const commands = new Map<string, { description: string; handler: Handler }>();
orgmExtension({
	registerCommand(name: string, command: { description: string; handler: Handler }) {
		commands.set(name, command);
	},
	on() {},
	getCommands() { return []; },
	getAllTools() { return []; },
} as any);

const notifications: Array<{ message: string; kind: string }> = [];
const ctx = {
	hasUI: true,
	cwd: process.cwd(),
	ui: {
		notify(message: string, kind: string) {
			notifications.push({ message, kind });
		},
		setHeader() {},
	},
};

try {
	const configDir = join(tempDir, ".pi", "agent");
	const configPath = join(configDir, "orgm.json");
	mkdirSync(configDir, { recursive: true });
	writeFileSync(configPath, JSON.stringify({
		unknownFutureKey: { keep: true },
		title: { autoGenerate: false },
		defaultPrimaryAgent: "pi-orchestrator",
		repoTree: { enabled: true, maxDepth: 3 },
		primaryAuto: { enabled: true },
	}, null, 2), "utf8");

	const command = commands.get("orgm-init");
	assert(command, "/orgm-init command should register");
	await command?.handler("", ctx);

	const saved = JSON.parse(readFileSync(configPath, "utf8"));
	assert.deepEqual(saved.unknownFutureKey, { keep: true }, "/orgm-init should preserve unknown top-level keys");
	assert.deepEqual(saved.mode, { defaultMode: "pi", allowedModes: ["pi", "plan", "build", "ask", "sdd", "tdd"] }, "/orgm-init should materialize mode defaults");
	assert.equal(saved.defaultPrimaryAgent, undefined, "/orgm-init should remove primary defaults");
	assert.equal(saved.repoTree, undefined, "/orgm-init should remove repo tree defaults");
	assert.equal(saved.primaryAuto, undefined, "/orgm-init should remove primary auto defaults");
	assert.equal(saved.title.autoGenerate, false, "/orgm-init should keep existing known values through merge");
	assert.equal(typeof saved.agentStatus?.showWidget, "boolean", "/orgm-init should write full defaults");
	assert.equal(notifications.at(-1)?.kind, "success", "/orgm-init should notify success");
	assert.match(notifications.at(-1)?.message ?? "", /orgm\.json/i, "/orgm-init success notification should mention orgm.json path");

	const extensionCommand = commands.get("orgm-extension");
	assert(extensionCommand, "/orgm-extension command should register");
	await extensionCommand?.handler("mode off", ctx);
	let updated = JSON.parse(readFileSync(configPath, "utf8"));
	assert.equal(updated.extensions.mode.enabled, false, "/orgm-extension mode off should persist enabled flag");
	await extensionCommand?.handler("ask permissions off", ctx);
	updated = JSON.parse(readFileSync(configPath, "utf8"));
	assert.equal(updated.extensions.ask.features.permissions.enabled, false, "/orgm-extension ask permissions off should persist feature flag");
} finally {
	if (previousHome === undefined) delete process.env.HOME;
	else process.env.HOME = previousHome;
	rmSync(tempDir, { recursive: true, force: true });
}
