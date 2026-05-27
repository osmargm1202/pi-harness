import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import modelPrimaryExtension from "../extensions/model-primary.ts";
import {
	PRIMARY_AUTO_STATE_ENTRY,
	resolvePrimaryAutoSelection,
	type PrimaryAutoCandidate,
} from "../extensions/lib/primary-auto.ts";

const PRIMARY_STATE_ENTRY = "pdd-primary-agent";

type Handler = (event: any, ctx: any) => unknown | Promise<unknown>;

type SubagentEnvSnapshot = {
	PI_PDD_SUBAGENT?: string;
	PI_SUBAGENT_RUNTIME_ID?: string;
	PI_SUBAGENT_RUNTIME_DEPTH?: string;
};

function setSubagentEnv(env: SubagentEnvSnapshot): SubagentEnvSnapshot {
	const previous: SubagentEnvSnapshot = {
		PI_PDD_SUBAGENT: process.env.PI_PDD_SUBAGENT,
		PI_SUBAGENT_RUNTIME_ID: process.env.PI_SUBAGENT_RUNTIME_ID,
		PI_SUBAGENT_RUNTIME_DEPTH: process.env.PI_SUBAGENT_RUNTIME_DEPTH,
	};
	for (const [key, value] of Object.entries(env)) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
	return previous;
}

function makeHarness(options?: {
	entries?: unknown[];
	configPath?: string;
	routePrimary?: (args: { prompt: string; candidates: PrimaryAutoCandidate[]; fallback: string; ctx: any }) => Promise<{ selectedName: string; reason?: string }>;
}) {
	const handlers = new Map<string, Handler>();
	const commands = new Map<string, { description: string; handler: Function }>();
	const appendEntries: Array<{ customType: string; data: unknown }> = [];
	const emitted: Array<{ event: string; data: unknown }> = [];
	const notifications: Array<{ message: string; kind: string }> = [];
	const workingMessages: Array<string | undefined> = [];
	const statuses: Array<{ id: string; message?: string }> = [];

	const pi = {
		on(event: string, handler: Handler) {
			handlers.set(event, handler);
		},
		registerCommand(name: string, command: { description: string; handler: Function }) {
			commands.set(name, command);
		},
		registerShortcut() {},
		appendEntry(customType: string, data: unknown) {
			appendEntries.push({ customType, data });
		},
		events: {
			emit(event: string, data: unknown) {
				emitted.push({ event, data });
			},
		},
	};

	const ctx = {
		cwd: process.cwd(),
		hasUI: true,
		ui: {
			notify(message: string, kind: string) {
				notifications.push({ message, kind });
			},
			setWorkingMessage(message?: string) {
				workingMessages.push(message);
			},
			setStatus(id: string, message?: string) {
				statuses.push({ id, message });
			},
		},
		sessionManager: {
			getEntries: () => options?.entries ?? [],
		},
	};

	modelPrimaryExtension(pi as never, {
		configPath: options?.configPath,
		routePrimary: options?.routePrimary,
	} as never);

	return { handlers, commands, appendEntries, emitted, notifications, workingMessages, statuses, ctx };
}

{
	const fallback = resolvePrimaryAutoSelection('{"selectedName":"missing"}', [
		{ name: "pi-orchestrator", description: "General orchestrator" },
	], "pi");
	assert.equal(fallback.selectedName, "pi", "invalid router output should fall back safely");
	assert.equal(fallback.source, "fallback", "invalid router output should be marked as fallback");
}

{
	const tempDir = mkdtempSync(join(tmpdir(), "primary-auto-"));
	const configPath = join(tempDir, "orgm.json");
	writeFileSync(configPath, JSON.stringify({ defaultPrimaryAgent: "pi" }, null, 2));
	const previousEnv = setSubagentEnv({
		PI_PDD_SUBAGENT: undefined,
		PI_SUBAGENT_RUNTIME_ID: undefined,
		PI_SUBAGENT_RUNTIME_DEPTH: undefined,
	});

	let routeCalls = 0;
	const harness = makeHarness({
		configPath,
		routePrimary: async ({ prompt, candidates, fallback }) => {
			routeCalls += 1;
			assert.equal(prompt, "Implement approved feature primary-auto", "router should receive first user prompt only");
			assert.equal(fallback, "pi", "router should receive current fallback primary");
			assert(candidates.some((candidate) => candidate.name === "pi-orchestrator"), "router should see discovered primary agents");
			return { selectedName: "pi-orchestrator", reason: "coding + routing task" };
		},
	});

	try {
		await harness.handlers.get("session_start")?.({ reason: "startup" }, harness.ctx);
		const firstResult = await harness.handlers.get("before_agent_start")?.({
			systemPrompt: "base system prompt",
			prompt: "Implement approved feature primary-auto",
		}, harness.ctx);
		assert.equal(routeCalls, 1, "first request should route once");
		assert.deepEqual(
			harness.workingMessages,
			["Auto-Primary-Agent...", undefined],
			"primary-auto should show and clear working message around routing",
		);
		assert.deepEqual(
			harness.statuses,
			[{ id: "primary-auto", message: "Auto-Primary-Agent..." }, { id: "primary-auto", message: undefined }],
			"primary-auto should set and clear footer status around routing",
		);
		assert.equal(JSON.parse(readFileSync(configPath, "utf8")).defaultPrimaryAgent, "pi", "auto routing should not rewrite defaultPrimaryAgent config");
		assert.equal(
			firstResult?.systemPrompt.includes("loaded from `pi-orchestrator`"),
			true,
			"routed primary should be applied through existing primary overlay",
		);
		assert.equal(
			harness.appendEntries.some((entry) => entry.customType === PRIMARY_AUTO_STATE_ENTRY),
			true,
			"first routing decision should persist session auto-route state",
		);
		assert.equal(
			harness.appendEntries.some((entry) => entry.customType === PRIMARY_STATE_ENTRY),
			true,
			"first routing decision should persist session primary state",
		);

		const secondResult = await harness.handlers.get("before_agent_start")?.({
			systemPrompt: "base system prompt",
			prompt: "Second prompt should not reroute",
		}, harness.ctx);
		assert.equal(routeCalls, 1, "later prompts in same session should not route again");
		assert.equal(
			secondResult?.systemPrompt.includes("loaded from `pi-orchestrator`"),
			true,
			"selected primary should stay active for later prompts in same session",
		);
	} finally {
		setSubagentEnv(previousEnv);
		rmSync(tempDir, { recursive: true, force: true });
	}
}

{
	const tempDir = mkdtempSync(join(tmpdir(), "primary-auto-route-error-"));
	const configPath = join(tempDir, "orgm.json");
	writeFileSync(configPath, JSON.stringify({ defaultPrimaryAgent: "pi" }, null, 2));
	const previousEnv = setSubagentEnv({
		PI_PDD_SUBAGENT: undefined,
		PI_SUBAGENT_RUNTIME_ID: undefined,
		PI_SUBAGENT_RUNTIME_DEPTH: undefined,
	});

	const harness = makeHarness({
		configPath,
		routePrimary: async () => {
			throw new Error("route boom");
		},
	});

	try {
		await harness.handlers.get("session_start")?.({ reason: "startup" }, harness.ctx);
		const result = await harness.handlers.get("before_agent_start")?.({
			systemPrompt: "base system prompt",
			prompt: "Route should fail safely",
		}, harness.ctx);
		assert.equal(result, undefined, "route failures should fall back to base system prompt when fallback primary is pi");
		assert.deepEqual(
			harness.workingMessages,
			["Auto-Primary-Agent...", undefined],
			"primary-auto should clear working message after router failure",
		);
		assert.deepEqual(
			harness.statuses,
			[{ id: "primary-auto", message: "Auto-Primary-Agent..." }, { id: "primary-auto", message: undefined }],
			"primary-auto should clear footer status after router failure",
		);
	} finally {
		setSubagentEnv(previousEnv);
		rmSync(tempDir, { recursive: true, force: true });
	}
}

{
	const tempDir = mkdtempSync(join(tmpdir(), "primary-auto-disabled-"));
	const configPath = join(tempDir, "orgm.json");
	writeFileSync(configPath, JSON.stringify({ primaryAuto: { enabled: false } }, null, 2));
	const previousEnv = setSubagentEnv({
		PI_PDD_SUBAGENT: undefined,
		PI_SUBAGENT_RUNTIME_ID: undefined,
		PI_SUBAGENT_RUNTIME_DEPTH: undefined,
	});

	let routeCalls = 0;
	const harness = makeHarness({
		configPath,
		routePrimary: async () => {
			routeCalls += 1;
			return { selectedName: "pi-orchestrator" };
		},
	});

	try {
		await harness.handlers.get("session_start")?.({ reason: "startup" }, harness.ctx);
		const result = await harness.handlers.get("before_agent_start")?.({
			systemPrompt: "base system prompt",
			prompt: "Do not auto route",
		}, harness.ctx);
		assert.equal(routeCalls, 0, "disabled primaryAuto should skip router call");
		assert.equal(result, undefined, "disabled primaryAuto with pi fallback should keep default system prompt");
	} finally {
		setSubagentEnv(previousEnv);
		rmSync(tempDir, { recursive: true, force: true });
	}
}

{
	const tempDir = mkdtempSync(join(tmpdir(), "primary-auto-command-"));
	const configPath = join(tempDir, "orgm.json");
	writeFileSync(configPath, JSON.stringify({}, null, 2));
	const harness = makeHarness({ configPath });

	try {
		const command = harness.commands.get("orgm-primary-auto");
		assert(command, "/orgm-primary-auto command should register");
		await command?.handler("false", harness.ctx);
		assert.equal(JSON.parse(readFileSync(configPath, "utf8")).primaryAuto.enabled, false, "command should persist disabled primaryAuto config");
		assert.equal(harness.notifications.at(-1)?.message, "Primary auto disabled", "command should notify disabled state");

		await command?.handler("true", harness.ctx);
		assert.equal(JSON.parse(readFileSync(configPath, "utf8")).primaryAuto.enabled, true, "command should persist enabled primaryAuto config");
		assert.equal(harness.notifications.at(-1)?.message, "Primary auto enabled", "command should notify enabled state");
	} finally {
		rmSync(tempDir, { recursive: true, force: true });
	}
}
