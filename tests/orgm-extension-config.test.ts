import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	buildOrgmExtensionCommandCompletions,
	isOrgmExtensionEnabled,
	parseOrgmExtensionCommand,
	resolveOrgmExtensionConfig,
	setOrgmExtensionFeature,
} from "../extensions/lib/orgm-extension-config.ts";
import { loadOrgmConfig } from "../extensions/lib/orgm-config.ts";

const tempDir = mkdtempSync(join(tmpdir(), "orgm-extension-config-"));
const configPath = join(tempDir, "orgm.json");

try {
	const defaultConfig = loadOrgmConfig(configPath);
	assert.equal(isOrgmExtensionEnabled("ask", defaultConfig, "questions"), true, "ask questions should default on");
	assert.equal(isOrgmExtensionEnabled("ask", defaultConfig, "permissions"), false, "ask permissions should default off");
	assert.equal(isOrgmExtensionEnabled("todo", defaultConfig), true, "todo extension should default on");
	assert.equal(isOrgmExtensionEnabled("title", defaultConfig), true, "unknown extension should default on");
	assert.equal(isOrgmExtensionEnabled("limit", defaultConfig), true, "limit extension should default on");

	writeFileSync(configPath, JSON.stringify({
		extensions: {
			ask: { enabled: true, questions: { enabled: false }, permissions: { enabled: true } },
			todo: { enabled: true },
			title: { enabled: false },
		},
	}, null, 2), "utf8");
	const config = loadOrgmConfig(configPath);
	assert.equal(resolveOrgmExtensionConfig(config, "ask", "questions").enabled, false, "ask question feature should load override");
	assert.equal(resolveOrgmExtensionConfig(config, "ask", "permissions").enabled, true, "ask permission feature should load override");
	assert.equal(isOrgmExtensionEnabled("todo", config), true, "todo should load enabled override");
	assert.equal(isOrgmExtensionEnabled("title", config), false, "generic extension enabled should load override");

	assert.deepEqual(parseOrgmExtensionCommand("ask questions off"), { extension: "ask", feature: "questions", action: "off" });
	assert.deepEqual(parseOrgmExtensionCommand("ask permission on"), { extension: "ask", feature: "permissions", action: "on" });
	assert.deepEqual(parseOrgmExtensionCommand("todo toggle"), { extension: "todo", action: "toggle" });
	assert.deepEqual(parseOrgmExtensionCommand("todo"), { extension: "todo", action: "status" });
	assert.equal(parseOrgmExtensionCommand("ask nope later")?.error, "Unknown action: later");

	setOrgmExtensionFeature("ask", "permissions", true, configPath);
	assert.equal(loadOrgmConfig(configPath).extensions.ask.features.permissions.enabled, true, "feature update should persist normalized shape");
	setOrgmExtensionFeature("todo", undefined, false, configPath);
	assert.equal(loadOrgmConfig(configPath).extensions.todo.enabled, false, "extension update should persist enabled flag");

	const askCompletions = buildOrgmExtensionCommandCompletions("ask p").map((item) => item.value);
	assert(askCompletions.includes("ask permissions on"), "autocomplete should include ask permissions on");
	assert(askCompletions.includes("ask permissions off"), "autocomplete should include ask permissions off");
	const todoCompletions = buildOrgmExtensionCommandCompletions("todo ").map((item) => item.value);
	assert(todoCompletions.includes("todo on"), "autocomplete should include todo on");
	assert(todoCompletions.includes("todo off"), "autocomplete should include todo off");
	const limitCompletions = buildOrgmExtensionCommandCompletions("limit ").map((item) => item.value);
	assert(limitCompletions.includes("limit on"), "autocomplete should include limit on");
	assert(limitCompletions.includes("limit off"), "autocomplete should include limit off");
} finally {
	rmSync(tempDir, { recursive: true, force: true });
}
