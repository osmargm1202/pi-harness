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
	}, null, 2), "utf8");

	const command = commands.get("orgm-init");
	assert(command, "/orgm-init command should register");
	await command?.handler("", ctx);

	const saved = JSON.parse(readFileSync(configPath, "utf8"));
	assert.deepEqual(saved.unknownFutureKey, { keep: true }, "/orgm-init should preserve unknown top-level keys");
	assert.deepEqual(saved.primaryAuto, { enabled: true }, "/orgm-init should materialize primaryAuto defaults");
	assert.equal(saved.title.autoGenerate, false, "/orgm-init should keep existing known values through merge");
	assert.equal(typeof saved.agentStatus?.showWidget, "boolean", "/orgm-init should write full defaults");
	const settings = JSON.parse(readFileSync(join(configDir, "settings.json"), "utf8"));
	assert(settings.extensions.some((entry: string) => entry.endsWith("extensions/repo-index.ts")), "/orgm-init should enable repo-index/repo-tree extension when missing");
	assert.equal(notifications.at(-1)?.kind, "success", "/orgm-init should notify success");
	assert.match(notifications.at(-1)?.message ?? "", /orgm\.json/i, "/orgm-init success notification should mention orgm.json path");
} finally {
	if (previousHome === undefined) delete process.env.HOME;
	else process.env.HOME = previousHome;
	rmSync(tempDir, { recursive: true, force: true });
}
