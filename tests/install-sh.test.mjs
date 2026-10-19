import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repo = fileURLToPath(new URL("../", import.meta.url));
const expected = [
	"git:github.com/osmargm1202/pi-todo@3a36a9b9ee3213db157843999b5e262f6a16267c",
	"git:github.com/osmargm1202/pi-subagents@e07e82d98e8af17da34ceb826c24b8c8d7de6fce",
	"git:github.com/osmargm1202/pi-title@a06dc038089bf360243bb501404595143d9213dc",
	"git:github.com/osmargm1202/pi-themes@fce797a2334609b93043337f3cd587f40de4466d",
	"git:github.com/osmargm1202/pi-footer@47cce5267501a3cd62e2ce6c58b66aed475339db",
	"git:github.com/osmargm1202/pi-ask@c6c7a70b17d025e4c9b2b6244dc56483869935a0",
	"git:github.com/osmargm1202/pi-notify@a294591eb4064db484e3496687bb7f7bc163cd5e",
	"npm:pi-web-access@0.42.0", "npm:gentle-engram@0.4.2",
	"npm:pi-mcp-adapter@5.3.2", "npm:pi-intercom@0.17.1",
];

function fixture(t) {
	const root = mkdtempSync(path.join(tmpdir(), "harness-sh-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	const home = path.join(root, "home with spaces");
	const bin = path.join(root, "bin");
	mkdirSync(home);
	mkdirSync(bin);
	const log = path.join(root, "calls.jsonl");
	const fakePi = `#!${process.execPath}
import { appendFileSync } from 'node:fs';
appendFileSync(process.env.CALL_LOG, JSON.stringify({ args: process.argv.slice(2), cwd: process.cwd() }) + '\\n');
if (process.env.FAIL_PACKAGE && process.argv.includes(process.env.FAIL_PACKAGE)) process.exit(42);
`;
	writeFileSync(path.join(bin, "pi"), fakePi, { mode: 0o755 });
	// Never download from the network or invoke a real npm installation in tests.
	writeFileSync(path.join(bin, "curl"), '#!/bin/sh\necho "unexpected network" >&2\nexit 89\n', { mode: 0o755 });
	writeFileSync(path.join(bin, "npm"), '#!/bin/sh\necho "unexpected npm" >&2\nexit 90\n', { mode: 0o755 });
	return {
		root, home, bin, log,
		run(args = [], env = {}, input) {
			return spawnSync("bash", input === undefined ? [path.join(repo, "install.sh"), ...args] : ["-s", "--", ...args], {
				cwd: root, input, encoding: "utf8", timeout: 10000,
				env: { ...process.env, HOME: home, PI_CODING_AGENT_DIR: "", CALL_LOG: log, PATH: `${bin}:${process.env.PATH}`, ...env },
			});
		},
		calls() { return existsSync(log) ? readFileSync(log, "utf8").trim().split("\n").map(JSON.parse) : []; },
	};
}

function success(result) { assert.equal(result.status, 0, result.stderr || result.stdout); }

test("shell setup installs exactly the current pinned matrix and configures Intercom", (t) => {
	const f = fixture(t);
	success(f.run());
	assert.deepEqual(f.calls().map((call) => call.args), expected.map((source) => ["install", source]));
	assert.ok(f.calls().every((call) => call.cwd !== f.root), "ignore invoking project config");
	const agent = path.join(f.home, ".pi", "agent");
	assert.deepEqual(JSON.parse(readFileSync(path.join(agent, "intercom", "config.json"))), {
		enabled: true, inboundTrigger: "always", busyDelivery: "human-first", replyHint: true,
	});
	assert.deepEqual(JSON.parse(readFileSync(path.join(agent, "settings.json"))).extensions, ["-builtin:mcp"]);
	assert.equal(existsSync(path.join(agent, "auth.json")), false);
});

test("shell dry-run does not invoke pi or npm, create config, or download anything", (t) => {
	const f = fixture(t);
	const result = f.run(["--dry-run"]);
	success(result);
	for (const source of expected) assert.ok(result.stdout.includes(`pi install ${source}`));
	assert.match(result.stdout, /"inboundTrigger": "always"/);
	assert.deepEqual(f.calls(), []);
	assert.deepEqual(readdirSync(f.home), []);
});

test("setup preserves user settings, backs up changes, and respects a relative config directory", (t) => {
	const f = fixture(t);
	const agent = path.join(f.root, "custom agent");
	mkdirSync(agent);
	const original = '{"defaultModel":"user-model","packages":["npm:user-package"],"extensions":["./mine.ts","+builtin:mcp"]}\n';
	writeFileSync(path.join(agent, "settings.json"), original);
	const env = { PI_CODING_AGENT_DIR: " ./custom agent " };
	success(f.run([], env));
	const settings = JSON.parse(readFileSync(path.join(agent, "settings.json")));
	assert.deepEqual(settings, { defaultModel: "user-model", packages: ["npm:user-package"], extensions: ["./mine.ts", "-builtin:mcp"] });
	const backups = readdirSync(agent).filter((name) => name.startsWith("settings.json.backup-"));
	assert.equal(backups.length, 1);
	assert.equal(readFileSync(path.join(agent, backups[0]), "utf8"), original);
	success(f.run([], env));
	assert.deepEqual(readdirSync(agent).filter((name) => name.startsWith("settings.json.backup-")), backups);
});

test("a failed package stops setup and does not enable Intercom", (t) => {
	const f = fixture(t);
	const result = f.run([], { FAIL_PACKAGE: expected[1] });
	assert.notEqual(result.status, 0);
	assert.equal(f.calls().length, 2);
	assert.equal(existsSync(path.join(f.home, ".pi", "agent", "intercom")), false);
});

test("unknown shell options fail before installation", (t) => {
	const f = fixture(t);
	assert.notEqual(f.run(["--typo"]).status, 0);
	assert.deepEqual(f.calls(), []);
});

test("piped entrypoint downloads one snapshot and cleans temporary files", (t) => {
	const f = fixture(t);
	const archiveRoot = path.join(f.root, "snapshot");
	mkdirSync(archiveRoot);
	cpSync(path.join(repo, "scripts"), path.join(archiveRoot, "scripts"), { recursive: true });
	cpSync(path.join(repo, "package.json"), path.join(archiveRoot, "package.json"));
	const archive = path.join(f.root, "snapshot.tgz");
	const packed = spawnSync("tar", ["-czf", archive, "-C", f.root, "snapshot"]);
	assert.equal(packed.status, 0);
	writeFileSync(path.join(f.bin, "curl"), `#!/bin/sh\nprintf '%s\\n' "$*" > "$CURL_LOG"\nwhile [ "$#" -gt 0 ]; do\n  if [ "$1" = -o ]; then cp "$ARCHIVE" "$2"; exit; fi\n  shift\ndone\nexit 91\n`, { mode: 0o755 });
	const temp = path.join(f.root, "temp");
	mkdirSync(temp);
	const curlLog = path.join(f.root, "curl.log");
	success(f.run([], { TMPDIR: temp, ARCHIVE: archive, CURL_LOG: curlLog }, readFileSync(path.join(repo, "install.sh"), "utf8")));
	assert.match(readFileSync(curlLog, "utf8"), /https:\/\/codeload.github.com\/osmargm1202\/pi-harness\/tar.gz\/main/);
	assert.equal(f.calls().length, expected.length);
	assert.deepEqual(readdirSync(temp), []);
	const failed = f.run([], { TMPDIR: temp, ARCHIVE: archive, CURL_LOG: curlLog, FAIL_PACKAGE: expected[0] }, readFileSync(path.join(repo, "install.sh"), "utf8"));
	assert.notEqual(failed.status, 0);
	assert.deepEqual(readdirSync(temp), [], "clean up snapshot and install cwd after failure too");
	writeFileSync(path.join(f.bin, "curl"), '#!/bin/sh\nexit 22\n', { mode: 0o755 });
	const downloadFailed = f.run([], { TMPDIR: temp }, readFileSync(path.join(repo, "install.sh"), "utf8"));
	assert.notEqual(downloadFailed.status, 0);
	assert.deepEqual(readdirSync(temp), [], "clean up after download failure");
});

for (const raw of ["{broken", "[]", '{"extensions":"wrong"}']) {
	test(`setup refuses unsafe settings: ${raw}`, (t) => {
		const f = fixture(t);
		const agent = path.join(f.home, ".pi", "agent");
		mkdirSync(agent, { recursive: true });
		writeFileSync(path.join(agent, "settings.json"), raw);
		assert.notEqual(f.run().status, 0);
		assert.deepEqual(f.calls(), []);
		assert.equal(readFileSync(path.join(agent, "settings.json"), "utf8"), raw);
		assert.equal(existsSync(path.join(agent, "intercom")), false);
	});
}

test("missing Pi is installed at the pinned runtime version without sudo", (t) => {
	const f = fixture(t);
	const piSource = path.join(f.root, "fake-pi");
	cpSync(path.join(f.bin, "pi"), piSource);
	rmSync(path.join(f.bin, "pi"));
	// An isolated PATH guarantees that a globally installed Pi cannot satisfy this test.
	for (const tool of ["bash", "node", "git", "dirname", "mktemp", "rm"]) {
		const found = spawnSync("bash", ["-c", `command -v ${tool}`], { encoding: "utf8" }).stdout.trim();
		symlinkSync(found, path.join(f.bin, tool));
	}
	writeFileSync(path.join(f.bin, "npm"), `#!${process.execPath}
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
writeFileSync(process.env.NPM_LOG, JSON.stringify(args));
const bin = path.join(args[args.indexOf('--prefix') + 1], 'bin');
mkdirSync(bin, { recursive: true });
copyFileSync(process.env.PI_SOURCE, path.join(bin, 'pi'));
`, { mode: 0o755 });
	const npmLog = path.join(f.root, "npm.json");
	const result = f.run([], { PATH: f.bin, NPM_LOG: npmLog, PI_SOURCE: piSource });
	success(result);
	assert.deepEqual(JSON.parse(readFileSync(npmLog, "utf8")), [
		"install", "--global", "--ignore-scripts", "--prefix", path.join(f.home, ".local"),
		"@earendil-works/pi-coding-agent@1.3.0",
	]);
	assert.equal(f.calls().length, expected.length);
	assert.match(result.stdout, /PATH/);
});

for (const file of ["settings.json", "intercom/config.json"]) {
	test(`setup refuses managed symlink ${file} before installing anything`, (t) => {
		const f = fixture(t);
		const agent = path.join(f.home, ".pi", "agent");
		const config = path.join(agent, file);
		mkdirSync(path.dirname(config), { recursive: true });
		const target = path.join(f.root, "managed.json");
		writeFileSync(target, "{}");
		symlinkSync(target, config);
		assert.notEqual(f.run().status, 0);
		assert.deepEqual(f.calls(), []);
		assert.equal(readFileSync(target, "utf8"), "{}");
	});
}
