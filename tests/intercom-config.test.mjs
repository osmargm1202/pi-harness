import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, lstatSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = fileURLToPath(new URL("../scripts/install-orgm-pi-packages.mjs", import.meta.url));

function fixture(t) {
	const root = mkdtempSync(path.join(tmpdir(), "pi-harness-intercom-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const agentDir = path.join(root, "agent");
	const configDir = path.join(agentDir, "intercom");
	const configPath = path.join(configDir, "config.json");
	return {
		root, agentDir, configDir, configPath,
		seed(raw) {
			mkdirSync(configDir, { recursive: true });
			writeFileSync(configPath, raw);
		},
		run(args = ["--configure-intercom"], env = {}) {
			return spawnSync(process.execPath, [script, ...args], {
				cwd: root,
				encoding: "utf8",
				timeout: 5000,
				// No installer subprocess may reach a real pi binary, even before the fix.
				env: { ...process.env, PATH: "", PI_CODING_AGENT_DIR: agentDir, ...env },
			});
		},
		read() { return JSON.parse(readFileSync(configPath, "utf8")); },
	};
}

function succeeded(result) {
	assert.equal(result.status, 0, result.stderr || result.stdout);
	assert.doesNotMatch(result.stdout, /> pi install /, "configuration must not reinstall the stack");
}

test("explicit configuration creates an auto-waking, human-first intercom config", (t) => {
	const f = fixture(t);
	const result = f.run();
	succeeded(result);
	assert.deepEqual(f.read(), { enabled: true, inboundTrigger: "always", busyDelivery: "human-first", replyHint: true });
	assert.match(result.stdout, /reload/i);
	assert.deepEqual(readdirSync(f.configDir), ["config.json"]);
	if (process.platform !== "win32") assert.equal(statSync(f.configPath).mode & 0o777, 0o600);
});

test("existing settings are preserved, only wake and delivery policy are changed, with an exact backup", (t) => {
	const f = fixture(t);
	const original = '{\n  "inboundTrigger": "replies", "enabled": false, "replyHint": false,\n  "confirmSend": true, "stableId": "worker", "crossMachine": {"machineName": "test"}\n}\n';
	f.seed(original);
	const result = f.run();
	succeeded(result);
	assert.deepEqual(f.read(), {
		enabled: true, inboundTrigger: "always", busyDelivery: "human-first", replyHint: false,
		confirmSend: true, stableId: "worker", crossMachine: { machineName: "test" },
	});
	const backups = readdirSync(f.configDir).filter((name) => name.startsWith("config.json.backup-"));
	assert.equal(backups.length, 1);
	assert.equal(readFileSync(path.join(f.configDir, backups[0]), "utf8"), original);
	assert.match(result.stdout, /backup-/);
});

test("configuration is idempotent and does not rewrite or back up an already matching file", (t) => {
	const f = fixture(t);
	succeeded(f.run());
	const original = readFileSync(f.configPath, "utf8");
	const modifiedAt = statSync(f.configPath).mtimeMs;
	succeeded(f.run());
	assert.equal(readFileSync(f.configPath, "utf8"), original);
	assert.equal(statSync(f.configPath).mtimeMs, modifiedAt);
	assert.deepEqual(readdirSync(f.configDir), ["config.json"]);
});

test("dry-run previews the new configuration without creating directories", (t) => {
	const f = fixture(t);
	const result = f.run(["--configure-intercom", "--dry-run"]);
	succeeded(result);
	assert.match(result.stdout, /"inboundTrigger": "always"/);
	assert.match(result.stdout, /"busyDelivery": "human-first"/);
	assert.deepEqual(readdirSync(f.root), []);
});

test("dry-run does not modify or back up an existing configuration", (t) => {
	const f = fixture(t);
	const original = '{"inboundTrigger":"replies","status":"working"}\n';
	f.seed(original);
	succeeded(f.run(["--configure-intercom", "-d"]));
	assert.equal(readFileSync(f.configPath, "utf8"), original);
	assert.deepEqual(readdirSync(f.configDir), ["config.json"]);
});

for (const invalid of ["{broken", "null", "[]", '"text"', "true"]) {
	test(`invalid configuration ${invalid} is rejected without overwriting it`, (t) => {
		const f = fixture(t);
		f.seed(invalid);
		const result = f.run();
		assert.notEqual(result.status, 0);
		assert.match(result.stderr, /config|JSON/i);
		assert.equal(readFileSync(f.configPath, "utf8"), invalid);
		assert.deepEqual(readdirSync(f.configDir), ["config.json"]);
	});
}

test("a symlinked config is rejected without replacing the link or changing its target", (t) => {
	const f = fixture(t);
	mkdirSync(f.configDir, { recursive: true });
	const target = path.join(f.root, "managed-config.json");
	const original = '{"inboundTrigger":"replies"}';
	writeFileSync(target, original);
	symlinkSync(target, f.configPath);
	const result = f.run();
	assert.notEqual(result.status, 0);
	assert.match(result.stderr, /simbólico|symlink/i);
	assert.ok(lstatSync(f.configPath).isSymbolicLink());
	assert.equal(readFileSync(target, "utf8"), original);
	assert.deepEqual(readdirSync(f.configDir), ["config.json"]);
});

test("a dangling config symlink is rejected instead of being silently replaced", (t) => {
	const f = fixture(t);
	mkdirSync(f.configDir, { recursive: true });
	symlinkSync(path.join(f.root, "missing.json"), f.configPath);
	const result = f.run();
	assert.notEqual(result.status, 0);
	assert.ok(lstatSync(f.configPath).isSymbolicLink());
	assert.deepEqual(readdirSync(f.configDir), ["config.json"]);
});

test("relative PI_CODING_AGENT_DIR is resolved from the caller's cwd", (t) => {
	const f = fixture(t);
	succeeded(f.run(["--configure-intercom"], { PI_CODING_AGENT_DIR: " ./relative-agent " }));
	const config = JSON.parse(readFileSync(path.join(f.root, "relative-agent", "intercom", "config.json"), "utf8"));
	assert.equal(config.inboundTrigger, "always");
	assert.deepEqual(readdirSync(f.root), ["relative-agent"]);
});

test("default agent directory follows HOME without touching the real user config", (t) => {
	const f = fixture(t);
	succeeded(f.run(["--configure-intercom"], { PI_CODING_AGENT_DIR: "", HOME: f.root, USERPROFILE: f.root }));
	const config = JSON.parse(readFileSync(path.join(f.root, ".pi", "agent", "intercom", "config.json"), "utf8"));
	assert.equal(config.inboundTrigger, "always");
});

test("ordinary install dry-run does not change intercom policy", (t) => {
	const f = fixture(t);
	f.seed('{"inboundTrigger":"never"}');
	const result = f.run(["--dry-run"]);
	assert.equal(result.status, 0, result.stderr);
	assert.match(result.stdout, /> pi install /);
	assert.deepEqual(f.read(), { inboundTrigger: "never" });
});

test("postinstall cannot implicitly opt a user into model calls", (t) => {
	const f = fixture(t);
	const result = f.run(["--postinstall", "--force", "--configure-intercom"]);
	assert.notEqual(result.status, 0);
	assert.deepEqual(readdirSync(f.root), []);
});

test("help documents configuration without invoking pi or writing files", (t) => {
	const f = fixture(t);
	const result = f.run(["--help"]);
	succeeded(result);
	assert.match(result.stdout, /--configure-intercom/);
	assert.match(result.stdout, /--dry-run/);
	assert.deepEqual(readdirSync(f.root), []);
});
