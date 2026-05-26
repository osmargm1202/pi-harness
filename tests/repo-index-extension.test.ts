import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import repoIndexExtension, { buildRepoTreeMessageContent, renderRepoTreeContent } from "../extensions/repo-index.ts";

function makeProject() {
	const home = mkdtempSync(join(tmpdir(), "repo-tree-home-"));
	const root = join(home, "Code", "demo");
	mkdirSync(join(root, "src"), { recursive: true });
	writeFileSync(join(root, "package.json"), JSON.stringify({ name: "demo" }));
	writeFileSync(join(root, "src", "main.ts"), "export const demo = true;\n");
	return { home, root, configPath: join(home, ".pi", "agent", "orgm.json") };
}

function createHarness(entries: unknown[] = []) {
	const handlers: Record<string, Function> = {};
	const renderers: Record<string, Function> = {};
	const commands: Record<string, { description: string; handler: Function }> = {};
	const sentMessages: unknown[] = [];
	const sendOptions: unknown[] = [];
	const pi = {
		on(event: string, handler: Function) {
			handlers[event] = handler;
		},
		registerMessageRenderer(type: string, renderer: Function) {
			renderers[type] = renderer;
		},
		registerCommand(name: string, command: { description: string; handler: Function }) {
			commands[name] = command;
		},
		sendMessage(message: unknown, options?: unknown) {
			sentMessages.push(message);
			sendOptions.push(options);
		},
	};
	const ctx = {
		cwd: "",
		sessionManager: {
			getEntries: () => entries,
		},
		ui: {
			notify() {},
		},
	};
	return { pi, ctx, handlers, renderers, commands, sentMessages, sendOptions };
}

{
	const { home, root } = makeProject();
	try {
		const content = buildRepoTreeMessageContent({ cwd: root }, { home, maxDepth: 2 });
		assert(content.includes("- demo/"), "tree content should include the project root");
		assert(content.includes("  - src/"), "tree content should include child directories");
		assert(content.includes("    - main.ts"), "tree content should include files within max depth");
		assert(!content.includes(".pi-cache"), "tree message content must not mention cache files");
		assert.equal(renderRepoTreeContent(content, false), "repo-tree", "collapsed render should be compact");
		assert.equal(renderRepoTreeContent(content, true), `repo-tree\n${content}`, "expanded render should include tree text");
	} finally {
		rmSync(home, { recursive: true, force: true });
	}
}

{
	const { home, root, configPath } = makeProject();
	try {
		const harness = createHarness();
		harness.ctx.cwd = root;
		repoIndexExtension(harness.pi as never, { home, configPath } as never);

		assert.deepEqual(Object.keys(harness.commands), ["orgm-repo-tree"], "only /orgm-repo-tree should be registered");
		assert(!harness.commands["orgm-repo-tree"].description.includes(".pi-cache"), "command description must not mention cache files");
		assert(harness.renderers["repo-tree"], "repo-tree renderer should be registered");

		await harness.handlers.session_start({ reason: "startup" }, harness.ctx);
		assert.equal(harness.sentMessages.length, 1, "eligible startup should inject exactly one tree message");
		assert.deepEqual(harness.sentMessages[0], {
			customType: "repo-tree",
			content: buildRepoTreeMessageContent({ cwd: root }, { home }),
			display: true,
			details: { source: "startup-repo-tree" },
		});
		assert.deepEqual(harness.sendOptions[0], { deliverAs: "nextTurn" }, "repo-tree should inject at session start like awareness");

		await harness.handlers.session_start({ reason: "startup" }, harness.ctx);
		assert.equal(harness.sentMessages.length, 1, "repo-tree injection should be idempotent within the extension lifecycle");
	} finally {
		rmSync(home, { recursive: true, force: true });
	}
}

{
	const { home, root, configPath } = makeProject();
	try {
		mkdirSync(join(home, ".pi", "agent"), { recursive: true });
		writeFileSync(configPath, JSON.stringify({ repoTree: { enabled: false, maxDepth: 3 } }), "utf8");
		const disabled = createHarness();
		disabled.ctx.cwd = root;
		repoIndexExtension(disabled.pi as never, { home, configPath } as never);
		await disabled.handlers.session_start({ reason: "startup" }, disabled.ctx);
		assert.equal(disabled.sentMessages.length, 0, "repo-tree should not inject when disabled in orgm.json");

		const withConversation = createHarness([{ type: "message", message: { role: "user" } }]);
		withConversation.ctx.cwd = root;
		repoIndexExtension(withConversation.pi as never, { home } as never);
		await withConversation.handlers.session_start({ reason: "startup" }, withConversation.ctx);
		assert.equal(withConversation.sentMessages.length, 0, "startup with conversation entries should not inject a tree message");

		const alreadyInjected = createHarness([{ type: "custom", customType: "repo-tree" }]);
		alreadyInjected.ctx.cwd = root;
		repoIndexExtension(alreadyInjected.pi as never, { home } as never);
		await alreadyInjected.handlers.session_start({ reason: "new" }, alreadyInjected.ctx);
		assert.equal(alreadyInjected.sentMessages.length, 0, "sessions that already contain repo-tree should not inject again");
	} finally {
		rmSync(home, { recursive: true, force: true });
	}
}
