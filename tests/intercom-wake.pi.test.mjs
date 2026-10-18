// Optional, offline integration check against installed Pi + pi-intercom.
// Uses a real broker/AgentSession and a local faux provider, never a paid model.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import test from "node:test";

const intercomDir = process.env.PI_INTERCOM_PACKAGE;
const sdkDir = process.env.PI_SDK_PACKAGE;
const installer = fileURLToPath(new URL("../scripts/install-orgm-pi-packages.mjs", import.meta.url));

async function waitFor(predicate, description) {
	const deadline = Date.now() + 10000;
	while (!(await predicate())) {
		if (Date.now() > deadline) throw new Error(`Timed out: ${description}`);
		await new Promise((resolve) => setTimeout(resolve, 20));
	}
}

function textOf(message) {
	return typeof message.content === "string" ? message.content :
		(message.content ?? []).map((block) => block.text ?? "").join("");
}

test("replies-only suppresses new send/ask turns; configured intercom wakes a real idle Pi session", {
	skip: !intercomDir || !sdkDir ? "Set PI_INTERCOM_PACKAGE and PI_SDK_PACKAGE to installed package directories" : false,
	timeout: 45000,
}, async (t) => {
	// A short isolated agent path keeps Unix sockets under their length limit.
	const root = mkdtempSync(path.join(tmpdir(), "pi-wake-"));
	const previousEnv = { ...process.env };
	const override = {
		HOME: root, USERPROFILE: root, PI_CODING_AGENT_DIR: root,
		PI_INTERCOM_SCOPE_ID: "", PI_INTERCOM_SESSION_ID: "", PI_INTERCOM_STABLE_ID: "",
		PI_SUBAGENT_ORCHESTRATOR_TARGET: "", PI_SUBAGENT_ORCHESTRATOR_SESSION_ID: "",
	};
	Object.assign(process.env, override);
	const cleanups = [];
	t.after(async () => {
		try {
			for (const cleanup of cleanups.reverse()) await cleanup();
		} finally {
			for (const key of Object.keys(override)) {
				if (previousEnv[key] === undefined) delete process.env[key];
				else process.env[key] = previousEnv[key];
			}
			rmSync(root, { recursive: true, force: true });
		}
	});
	mkdirSync(path.join(root, "intercom"));
	writeFileSync(path.join(root, "intercom", "config.json"), JSON.stringify({
		enabled: true, inboundTrigger: "replies", busyDelivery: "human-first", replyHint: true,
	}));

	const intercomRequire = createRequire(path.join(intercomDir, "package.json"));
	const { register, tsImport } = await import(pathToFileURL(intercomRequire.resolve("tsx/esm/api")).href);
	const unregister = register();
	cleanups.push(() => unregister());
	const { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager } =
		await import(pathToFileURL(path.join(sdkDir, "dist", "index.js")).href);
	const { fauxProvider, fauxAssistantMessage } = await tsImport("@earendil-works/pi-ai", pathToFileURL(path.join(sdkDir, "package.json")).href);
	const { IntercomClient } = await import(pathToFileURL(path.join(intercomDir, "broker", "client.ts")).href);

	const broker = spawn(process.execPath, ["--import", pathToFileURL(intercomRequire.resolve("tsx/esm")).href,
		path.join(intercomDir, "broker", "broker.ts")], {
		cwd: intercomDir, env: { ...process.env }, stdio: ["ignore", "pipe", "pipe"],
	});
	let brokerOutput = "";
	broker.stdout.on("data", (chunk) => { brokerOutput += chunk; });
	broker.stderr.on("data", (chunk) => { brokerOutput += chunk; });
	cleanups.push(async () => {
		if (broker.exitCode === null && broker.signalCode === null) {
			const exited = once(broker, "exit");
			broker.kill("SIGTERM");
			await exited;
		}
	});
	await waitFor(() => {
		if (broker.exitCode !== null) throw new Error(brokerOutput);
		return brokerOutput.includes("Intercom broker started");
	}, "isolated broker startup");

	const planner = new IntercomClient();
	cleanups.push(() => planner.disconnect());
	await planner.connect({ name: "wake-test-planner", cwd: root, model: "faux", pid: process.pid, startedAt: Date.now(), lastActivity: Date.now() });
	const receipts = new Set();
	planner.onMessageReceipt((_from, receipt) => { receipts.add(`${receipt.messageId}:${receipt.status}`); });

	async function worker(name) {
		const agentDir = path.join(root, name);
		mkdirSync(agentDir);
		const faux = fauxProvider({ provider: `faux-${name}` });
		const modelRuntime = await ModelRuntime.create({ authPath: path.join(agentDir, "auth.json"), modelsPath: null, refreshOnCreate: false });
		modelRuntime.registerNativeProvider(faux.provider);
		const calls = [];
		faux.setResponses(Array.from({ length: 8 }, () => (context) => {
			calls.push(context.messages.map(textOf).join("\n"));
			return fauxAssistantMessage("Offline intercom wake confirmed.");
		}));
		const loader = new DefaultResourceLoader({
			cwd: root, agentDir, noExtensions: true, noSkills: true, noPromptTemplates: true,
			noThemes: true, noContextFiles: true,
			additionalExtensionPaths: [path.join(intercomDir, "index.ts")],
		});
		await loader.reload();
		assert.deepEqual(loader.getExtensions().errors, []);
		const { session } = await createAgentSession({
			cwd: root, agentDir, model: faux.getModel(), thinkingLevel: "off", modelRuntime,
			resourceLoader: loader, noTools: "builtin", sessionManager: SessionManager.inMemory(root),
			settingsManager: SettingsManager.inMemory({ compaction: { enabled: false }, retry: { enabled: false } }),
		});
		cleanups.push(async () => {
			await session.abort();
			await session.extensionRunner.emit({ type: "session_shutdown", reason: "quit" });
			session.dispose();
		});
		await session.bindExtensions({ mode: "tui", uiContext: { ...session.extensionRunner.getUIContext(), notify: () => {} } });
		session.setSessionName(name);
		let target;
		await waitFor(async () => {
			target = (await planner.listSessions()).find((peer) => peer.name === name);
			return Boolean(target);
		}, `registration of ${name}`);
		return { session, calls, target };
	}

	const restricted = await worker("replies-only");
	for (const [id, expectsReply] of [["restricted-send", false], ["restricted-ask", true]]) {
		assert.equal((await planner.send(restricted.target.id, { messageId: id, text: id, expectsReply })).delivered, true);
		await waitFor(() => receipts.has(`${id}:injected`), `injection of ${id}`);
	}
	await new Promise((resolve) => setTimeout(resolve, 200));
	assert.equal(restricted.calls.length, 0, "send and initial ask are delivered but do not wake replies-only sessions");
	const result = spawnSync(process.execPath, [installer, "--configure-intercom"], { encoding: "utf8", env: { ...process.env } });
	assert.equal(result.status, 0, result.stderr);
	assert.equal(JSON.parse(readFileSync(path.join(root, "intercom", "config.json"), "utf8")).inboundTrigger, "always");
	const configured = await worker("auto-wake");
	for (const [index, expectsReply] of [false, true].entries()) {
		const id = `configured-${expectsReply ? "ask" : "send"}`;
		assert.equal((await planner.send(configured.target.id, { messageId: id, text: id, expectsReply })).delivered, true);
		await waitFor(() => configured.calls.length === index + 1 && configured.session.isIdle, `${id} wakes idle Pi`);
		assert.match(configured.calls[index], new RegExp(id));
	}
});
