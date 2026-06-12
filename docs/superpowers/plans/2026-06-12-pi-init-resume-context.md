# pi-init / pi-resume Context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redefine `pi-init` and `pi-resume` so `/orgm-init` generates project context files and `/orgm-resume` generates a current handoff file.

**Architecture:** `pi-init` owns durable project context generation (`CONTEXT.md`, `AGENTS.md`) plus old config initialization as `/orgm-config-init`. `pi-resume` owns ephemeral continuity generation (`RESUME.md`) and, if needed, moves the old session picker to `/orgm-session-resume`. Both packages use small shared scanner/writer modules with deterministic bounded filesystem and git inspection.

**Tech Stack:** TypeScript ESM Pi extensions, Node built-ins (`fs`, `path`, `child_process`), `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, Node test runner.

---

## File Structure

### `pi-init`

- Create `extensions/lib/file-writer.ts`
  - Managed section replacement/append logic for generated markdown.
- Create `extensions/lib/repo-scan.ts`
  - Bounded repository scan for manifests, configs, docs, scripts, tree shape, git info.
- Create `extensions/lib/context-renderer.ts`
  - Render `CONTEXT.md` and `AGENTS.md` generated sections from scan data.
- Modify `extensions/init.ts`
  - `/orgm-init` generates context files.
  - `/orgm-config-init` preserves old orgm.json initialization behavior.
- Keep `extensions/lib/orgm-config.ts`
  - Existing config defaults/writer for `/orgm-config-init`.
- Add tests under `test/`.

### `pi-resume`

- Create `extensions/lib/file-writer.ts`
  - Same managed section logic, copied for package independence.
- Create `extensions/lib/resume-scan.ts`
  - Current branch, recent commits, dirty files, existing context file headings, recent specs/plans.
- Create `extensions/lib/resume-renderer.ts`
  - Render `RESUME.md` generated section.
- Modify `extensions/resume.ts`
  - `/orgm-resume` generates `RESUME.md`.
  - old session picker moves to `/orgm-session-resume`.
- Add tests under `test/`.

### `pi-harness`

- Modify `package-lock.json` only after package commits.
- Keep dependency on `pi-init` and `pi-resume`.
- Verify bundle command audit has zero non-`/orgm-*` commands.

---

### Task 1: Add managed markdown writer to `pi-init`

**Files:**
- Create: `/home/osmarg/Code/pi-init/extensions/lib/file-writer.ts`
- Create: `/home/osmarg/Code/pi-init/test/file-writer.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `/home/osmarg/Code/pi-init/test/file-writer.test.mjs`:

```js
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { writeManagedMarkdown } from "../extensions/lib/file-writer.ts";

test("writeManagedMarkdown creates a new generated file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-init-writer-"));
  const file = join(dir, "CONTEXT.md");
  try {
    await writeManagedMarkdown(file, "# Context\n\nGenerated body\n");
    const text = await readFile(file, "utf8");
    assert.match(text, /<!-- ORGM:BEGIN generated -->/);
    assert.match(text, /Generated body/);
    assert.match(text, /<!-- ORGM:END generated -->/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("writeManagedMarkdown replaces only managed section", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-init-writer-"));
  const file = join(dir, "AGENTS.md");
  try {
    await writeFile(file, "Manual top\n\n<!-- ORGM:BEGIN generated -->\nold\n<!-- ORGM:END generated -->\n\nManual bottom\n");
    await writeManagedMarkdown(file, "new body\n");
    const text = await readFile(file, "utf8");
    assert.match(text, /^Manual top/);
    assert.match(text, /new body/);
    assert.doesNotMatch(text, /old/);
    assert.match(text, /Manual bottom/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("writeManagedMarkdown appends managed section to manual file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-init-writer-"));
  const file = join(dir, "CONTEXT.md");
  try {
    await writeFile(file, "Manual notes\n");
    await writeManagedMarkdown(file, "generated\n");
    const text = await readFile(file, "utf8");
    assert.match(text, /^Manual notes/);
    assert.match(text, /generated/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
cd /home/osmarg/Code/pi-init
npm test -- test/file-writer.test.mjs
```

Expected: FAIL with module not found for `extensions/lib/file-writer.ts`.

- [ ] **Step 3: Implement writer**

Create `/home/osmarg/Code/pi-init/extensions/lib/file-writer.ts`:

```ts
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const BEGIN = "<!-- ORGM:BEGIN generated -->";
const END = "<!-- ORGM:END generated -->";

export function wrapManagedMarkdown(body: string): string {
	const clean = body.trimEnd();
	return `${BEGIN}\n${clean}\n${END}\n`;
}

export async function writeManagedMarkdown(filePath: string, body: string): Promise<void> {
	await mkdir(dirname(filePath), { recursive: true });
	const managed = wrapManagedMarkdown(body);
	if (!existsSync(filePath)) {
		await writeFile(filePath, managed, "utf8");
		return;
	}

	const current = await readFile(filePath, "utf8");
	const beginIndex = current.indexOf(BEGIN);
	const endIndex = current.indexOf(END);
	if (beginIndex >= 0 && endIndex > beginIndex) {
		const before = current.slice(0, beginIndex).trimEnd();
		const after = current.slice(endIndex + END.length).trimStart();
		const next = [before, managed.trimEnd(), after].filter(Boolean).join("\n\n") + "\n";
		await writeFile(filePath, next, "utf8");
		return;
	}

	const next = `${current.trimEnd()}\n\n${managed}`;
	await writeFile(filePath, next, "utf8");
}
```

- [ ] **Step 4: Run tests and verify GREEN**

Run:

```bash
cd /home/osmarg/Code/pi-init
npm test -- test/file-writer.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/osmarg/Code/pi-init
git add extensions/lib/file-writer.ts test/file-writer.test.mjs
git commit -m "feat: add managed markdown writer"
```

---

### Task 2: Add repository scanner to `pi-init`

**Files:**
- Create: `/home/osmarg/Code/pi-init/extensions/lib/repo-scan.ts`
- Create: `/home/osmarg/Code/pi-init/test/repo-scan.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `/home/osmarg/Code/pi-init/test/repo-scan.test.mjs`:

```js
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { scanRepository } from "../extensions/lib/repo-scan.ts";

test("scanRepository reads manifests scripts and ignores generated directories", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-init-scan-"));
  try {
    await writeFile(join(dir, "package.json"), JSON.stringify({
      name: "sample-app",
      scripts: { test: "node --test", build: "tsc" },
      dependencies: { react: "latest" },
      devDependencies: { typescript: "latest" }
    }, null, 2));
    await writeFile(join(dir, "README.md"), "# Sample App\n\nA test app.\n");
    await mkdir(join(dir, "src"));
    await writeFile(join(dir, "src", "index.ts"), "export const value = 1;\n");
    await mkdir(join(dir, "node_modules", "ignored"), { recursive: true });
    await writeFile(join(dir, "node_modules", "ignored", "package.json"), "{}");

    const scan = await scanRepository(dir);
    assert.equal(scan.packageName, "sample-app");
    assert.equal(scan.scripts.test, "node --test");
    assert(scan.stack.includes("TypeScript"));
    assert(scan.stack.includes("React"));
    assert(scan.importantFiles.includes("package.json"));
    assert(scan.importantFiles.includes("README.md"));
    assert(scan.tree.some((entry) => entry.includes("src/index.ts")));
    assert(!scan.tree.some((entry) => entry.includes("node_modules")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run tests and verify RED**

```bash
cd /home/osmarg/Code/pi-init
npm test -- test/repo-scan.test.mjs
```

Expected: FAIL with module not found for `repo-scan.ts`.

- [ ] **Step 3: Implement scanner**

Create `/home/osmarg/Code/pi-init/extensions/lib/repo-scan.ts`:

```ts
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const IGNORED_DIRS = new Set([".git", "node_modules", "dist", "build", ".next", "coverage", ".turbo"]);
const IMPORTANT_FILES = ["package.json", "README.md", "CONTEXT.md", "AGENTS.md", "tsconfig.json", "biome.json", "eslint.config.js", "pyproject.toml", "Cargo.toml", "go.mod", "deno.json"];

export type RepoScan = {
	root: string;
	packageName: string;
	scripts: Record<string, string>;
	stack: string[];
	importantFiles: string[];
	tree: string[];
	warnings: string[];
};

async function readJson(filePath: string): Promise<Record<string, any> | undefined> {
	try {
		return JSON.parse(await readFile(filePath, "utf8"));
	} catch {
		return undefined;
	}
}

async function walk(root: string, dir: string, out: string[], maxFiles: number): Promise<void> {
	if (out.length >= maxFiles) return;
	let entries;
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return;
	}
	for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
		if (out.length >= maxFiles) return;
		if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
		const full = join(dir, entry.name);
		const rel = relative(root, full);
		if (entry.isDirectory()) {
			out.push(`${rel}/`);
			await walk(root, full, out, maxFiles);
		} else {
			out.push(rel);
		}
	}
}

function detectStack(pkg: Record<string, any> | undefined, importantFiles: string[]): string[] {
	const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
	const stack = new Set<string>();
	if (pkg) stack.add("Node.js");
	if (deps.typescript || importantFiles.some((file) => file.startsWith("tsconfig"))) stack.add("TypeScript");
	if (deps.react) stack.add("React");
	if (deps.vitest) stack.add("Vitest");
	if (deps["@biomejs/biome"] || importantFiles.includes("biome.json")) stack.add("Biome");
	if (importantFiles.includes("pyproject.toml")) stack.add("Python");
	if (importantFiles.includes("Cargo.toml")) stack.add("Rust");
	if (importantFiles.includes("go.mod")) stack.add("Go");
	return [...stack];
}

export async function scanRepository(root: string, maxFiles = 250): Promise<RepoScan> {
	const warnings: string[] = [];
	const importantFiles = IMPORTANT_FILES.filter((file) => existsSync(join(root, file)));
	const pkg = await readJson(join(root, "package.json"));
	const tree: string[] = [];
	await walk(root, root, tree, maxFiles);
	if (tree.length >= maxFiles) warnings.push(`tree truncated at ${maxFiles} entries`);
	return {
		root,
		packageName: typeof pkg?.name === "string" ? pkg.name : "unknown-project",
		scripts: pkg?.scripts && typeof pkg.scripts === "object" ? pkg.scripts : {},
		stack: detectStack(pkg, importantFiles),
		importantFiles,
		tree,
		warnings,
	};
}
```

- [ ] **Step 4: Run tests and verify GREEN**

```bash
cd /home/osmarg/Code/pi-init
npm test -- test/repo-scan.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/osmarg/Code/pi-init
git add extensions/lib/repo-scan.ts test/repo-scan.test.mjs
git commit -m "feat: scan repository context"
```

---

### Task 3: Render CONTEXT.md and AGENTS.md in `pi-init`

**Files:**
- Create: `/home/osmarg/Code/pi-init/extensions/lib/context-renderer.ts`
- Create: `/home/osmarg/Code/pi-init/test/context-renderer.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `/home/osmarg/Code/pi-init/test/context-renderer.test.mjs`:

```js
import assert from "node:assert/strict";
import test from "node:test";
import { renderAgentsMarkdown, renderContextMarkdown } from "../extensions/lib/context-renderer.ts";

const scan = {
  root: "/repo/sample",
  packageName: "sample-app",
  scripts: { test: "node --test", build: "tsc" },
  stack: ["Node.js", "TypeScript"],
  importantFiles: ["package.json", "README.md"],
  tree: ["package.json", "README.md", "src/", "src/index.ts"],
  warnings: []
};

test("renderContextMarkdown includes stable project sections", () => {
  const text = renderContextMarkdown(scan);
  assert.match(text, /# Project Context/);
  assert.match(text, /## Overview/);
  assert.match(text, /sample-app/);
  assert.match(text, /## Current Stack/);
  assert.match(text, /TypeScript/);
  assert.match(text, /## Commands/);
  assert.match(text, /npm run test/);
  assert.match(text, /## Do Not Rediscover/);
});

test("renderAgentsMarkdown includes actionable agent instructions", () => {
  const text = renderAgentsMarkdown(scan);
  assert.match(text, /# Agent Instructions/);
  assert.match(text, /## Development Workflow/);
  assert.match(text, /## Verification Matrix/);
  assert.match(text, /npm run test/);
  assert.match(text, /CONTEXT.md/);
  assert.match(text, /RESUME.md/);
});
```

- [ ] **Step 2: Run tests and verify RED**

```bash
cd /home/osmarg/Code/pi-init
npm test -- test/context-renderer.test.mjs
```

Expected: FAIL with module not found for `context-renderer.ts`.

- [ ] **Step 3: Implement renderer**

Create `/home/osmarg/Code/pi-init/extensions/lib/context-renderer.ts`:

```ts
import type { RepoScan } from "./repo-scan.ts";

function list(items: string[]): string {
	return items.length ? items.map((item) => `- ${item}`).join("\n") : "- None detected";
}

function commandLines(scripts: Record<string, string>): string[] {
	return Object.entries(scripts).map(([name, command]) => `- \`npm run ${name}\` — \`${command}\``);
}

export function renderContextMarkdown(scan: RepoScan): string {
	const commands = commandLines(scan.scripts);
	return `# Project Context

## Overview

${scan.packageName} is a repository at \`${scan.root}\`. This file captures stable project context generated by ORGM Pi.

## Current Stack

${list(scan.stack)}

## Repository Map

${list(scan.tree.slice(0, 80))}

## Architecture / Ownership

- Project package: \`${scan.packageName}\`.
- Important files: ${scan.importantFiles.length ? scan.importantFiles.map((file) => `\`${file}\``).join(", ") : "none detected"}.
- Keep package responsibilities explicit when adding new code.

## Commands

${commands.length ? commands.join("\n") : "- No package scripts detected"}

## Configuration and Data

${list(scan.importantFiles)}

## Conventions

- Use ORGM slash command namespace: \`/orgm-*\`.
- Prefer TDD for feature work and bug fixes.
- Run targeted tests before claiming completion.

## Current Roadmap / Phases

- Keep this section updated manually when phases change.
- Use \`RESUME.md\` for active handoff state.

## Do Not Rediscover

- Read this file before re-analyzing the repository from scratch.
- Trust package manifests and scripts listed here unless files changed.
${scan.warnings.length ? `\n## Scan Warnings\n\n${list(scan.warnings)}\n` : ""}`;
}

export function renderAgentsMarkdown(scan: RepoScan): string {
	const commands = commandLines(scan.scripts);
	return `# Agent Instructions

## Project Rules

- Read \`CONTEXT.md\` first for durable project context.
- Read \`RESUME.md\` for current handoff state when continuing work.
- Keep generated ORGM sections intact unless intentionally regenerating them.

## Package Ownership

- Current project package: \`${scan.packageName}\`.
- Keep ownership boundaries documented in \`CONTEXT.md\`.

## Development Workflow

- Use TDD for behavior changes.
- Prefer small commits after green tests.
- Keep slash commands under \`/orgm-*\`.

## Verification Matrix

${commands.length ? commands.join("\n") : "- No scripts detected; use package-specific smoke checks."}

## Safety Notes

- Do not edit ignored/generated directories such as \`node_modules\`, \`dist\`, \`build\`, or \`.git\`.
- Ask before destructive changes.

## Context Files

- \`CONTEXT.md\`: stable project understanding.
- \`AGENTS.md\`: instructions for agents.
- \`RESUME.md\`: current handoff for the next session.
`;
}
```

- [ ] **Step 4: Run tests and verify GREEN**

```bash
cd /home/osmarg/Code/pi-init
npm test -- test/context-renderer.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/osmarg/Code/pi-init
git add extensions/lib/context-renderer.ts test/context-renderer.test.mjs
git commit -m "feat: render context and agent docs"
```

---

### Task 4: Redefine `/orgm-init` and add `/orgm-config-init`

**Files:**
- Modify: `/home/osmarg/Code/pi-init/extensions/init.ts`
- Modify: `/home/osmarg/Code/pi-init/test/package-shape.test.mjs`
- Create: `/home/osmarg/Code/pi-init/test/init-command.test.mjs`
- Modify: `/home/osmarg/Code/pi-init/README.md`

- [ ] **Step 1: Write failing tests**

Modify `/home/osmarg/Code/pi-init/test/package-shape.test.mjs` to require both commands:

```js
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("package ships orgm init commands", () => {
  assert.equal(pkg.name, "pi-init");
  assert.deepEqual(pkg.pi.extensions, ["./extensions/init.ts"]);
  assert.ok(pkg.peerDependencies["@earendil-works/pi-coding-agent"]);
  assert.ok(existsSync("extensions/init.ts"));
  const source = readFileSync("extensions/init.ts", "utf8");
  assert.match(source, /registerCommand\("orgm-init"/);
  assert.match(source, /registerCommand\("orgm-config-init"/);
  assert.match(source, /CONTEXT\.md/);
  assert.match(source, /AGENTS\.md/);
  assert.doesNotMatch(source, /registerCommand\("(?!orgm-)/);
});
```

Create `/home/osmarg/Code/pi-init/test/init-command.test.mjs`:

```js
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import initExtension from "../extensions/init.ts";

test("/orgm-init writes CONTEXT.md and AGENTS.md", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-init-command-"));
  try {
    await writeFile(join(dir, "package.json"), JSON.stringify({ name: "fixture", scripts: { test: "node --test" } }, null, 2));
    const commands = new Map();
    initExtension({ registerCommand(name, definition) { commands.set(name, definition); } });
    await commands.get("orgm-init").handler("", {
      cwd: dir,
      ui: { notify() {} }
    });
    assert.match(await readFile(join(dir, "CONTEXT.md"), "utf8"), /# Project Context/);
    assert.match(await readFile(join(dir, "AGENTS.md"), "utf8"), /# Agent Instructions/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run tests and verify RED**

```bash
cd /home/osmarg/Code/pi-init
npm test -- test/package-shape.test.mjs test/init-command.test.mjs
```

Expected: FAIL because `/orgm-config-init` is missing and `/orgm-init` does not write context files.

- [ ] **Step 3: Implement command behavior**

Replace `/home/osmarg/Code/pi-init/extensions/init.ts` with:

```ts
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { renderAgentsMarkdown, renderContextMarkdown } from "./lib/context-renderer.ts";
import { writeManagedMarkdown } from "./lib/file-writer.ts";
import { initializeOrgmConfig, orgmConfigPath } from "./lib/orgm-config.ts";
import { scanRepository } from "./lib/repo-scan.ts";

export default function (pi: ExtensionAPI) {
	pi.registerCommand("orgm-init", {
		description: "Generate ORGM CONTEXT.md and AGENTS.md for this project",
		handler: async (_args: string, ctx: ExtensionContext) => {
			const root = ctx.cwd;
			const scan = await scanRepository(root);
			await writeManagedMarkdown(join(root, "CONTEXT.md"), renderContextMarkdown(scan));
			await writeManagedMarkdown(join(root, "AGENTS.md"), renderAgentsMarkdown(scan));
			ctx.ui.notify("ORGM context files updated: CONTEXT.md, AGENTS.md", "success");
		},
	});

	pi.registerCommand("orgm-config-init", {
		description: "Materialize full ~/.pi/agent/orgm.json defaults",
		handler: async (_args: string, ctx: ExtensionContext) => {
			const configPath = orgmConfigPath();
			initializeOrgmConfig(configPath);
			ctx.ui.notify(`ORGM config initialized: ${configPath}`, "success");
		},
	});
}
```

Update README “Owns” section:

```markdown
## Owns

- `/orgm-init`: generate/update `CONTEXT.md` and `AGENTS.md` for the current project.
- `/orgm-config-init`: materialize full `~/.pi/agent/orgm.json` defaults.
```

- [ ] **Step 4: Run tests and verify GREEN**

```bash
cd /home/osmarg/Code/pi-init
npm test
npm run pack:check
PI_OFFLINE=1 pi --no-extensions -e /home/osmarg/Code/pi-init --list-models
```

Expected: tests pass, pack dry-run succeeds, smoke has no stderr.

- [ ] **Step 5: Commit and push**

```bash
cd /home/osmarg/Code/pi-init
git add extensions test README.md
git commit -m "feat: generate project context files"
git push origin main
```

---

### Task 5: Add managed writer and resume scanner to `pi-resume`

**Files:**
- Create: `/home/osmarg/Code/pi-resume/extensions/lib/file-writer.ts`
- Create: `/home/osmarg/Code/pi-resume/extensions/lib/resume-scan.ts`
- Create: `/home/osmarg/Code/pi-resume/test/resume-scan.test.mjs`

- [ ] **Step 1: Write failing tests**

Create `/home/osmarg/Code/pi-resume/test/resume-scan.test.mjs`:

```js
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { scanResumeState } from "../extensions/lib/resume-scan.ts";

const execFileAsync = promisify(execFile);

test("scanResumeState captures branch commits and dirty files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-resume-scan-"));
  try {
    await execFileAsync("git", ["init"], { cwd: dir });
    await execFileAsync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
    await execFileAsync("git", ["config", "user.name", "Test"], { cwd: dir });
    await writeFile(join(dir, "README.md"), "# Resume Fixture\n");
    await execFileAsync("git", ["add", "README.md"], { cwd: dir });
    await execFileAsync("git", ["commit", "-m", "initial commit"], { cwd: dir });
    await mkdir(join(dir, "docs"));
    await writeFile(join(dir, "dirty.txt"), "changed\n");
    await writeFile(join(dir, "CONTEXT.md"), "# Project Context\n\n## Overview\n\nText\n");

    const state = await scanResumeState(dir);
    assert(state.branch.length > 0);
    assert(state.recentCommits.some((commit) => commit.includes("initial commit")));
    assert(state.dirtyFiles.some((file) => file.includes("dirty.txt")));
    assert(state.contextHeadings.includes("Project Context"));
    assert(state.contextHeadings.includes("Overview"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run tests and verify RED**

```bash
cd /home/osmarg/Code/pi-resume
npm test -- test/resume-scan.test.mjs
```

Expected: FAIL with module not found for `resume-scan.ts`.

- [ ] **Step 3: Implement writer and scanner**

Create `/home/osmarg/Code/pi-resume/extensions/lib/file-writer.ts` using the same implementation from Task 1.

Create `/home/osmarg/Code/pi-resume/extensions/lib/resume-scan.ts`:

```ts
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ResumeState = {
	root: string;
	branch: string;
	recentCommits: string[];
	dirtyFiles: string[];
	contextHeadings: string[];
	recentDocs: string[];
	warnings: string[];
};

async function git(root: string, args: string[]): Promise<string> {
	try {
		const { stdout } = await execFileAsync("git", args, { cwd: root });
		return stdout.trim();
	} catch {
		return "";
	}
}

async function headings(filePath: string): Promise<string[]> {
	if (!existsSync(filePath)) return [];
	const text = await readFile(filePath, "utf8");
	return Array.from(text.matchAll(/^#+\s+(.+)$/gm), (match) => match[1].trim()).slice(0, 40);
}

async function listRecentDocs(root: string): Promise<string[]> {
	const docsDir = join(root, "docs");
	if (!existsSync(docsDir)) return [];
	const out: string[] = [];
	async function walk(dir: string): Promise<void> {
		for (const entry of await readdir(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) await walk(full);
			else if (entry.name.endsWith(".md")) out.push(full.replace(`${root}/`, ""));
		}
	}
	await walk(docsDir);
	return out.sort().slice(-20);
}

export async function scanResumeState(root: string): Promise<ResumeState> {
	const warnings: string[] = [];
	const branch = await git(root, ["branch", "--show-current"]);
	const commits = await git(root, ["log", "--oneline", "-8"]);
	const status = await git(root, ["status", "--short"]);
	if (!branch) warnings.push("git branch unavailable");
	return {
		root,
		branch: branch || "not-a-git-repo",
		recentCommits: commits ? commits.split("\n") : [],
		dirtyFiles: status ? status.split("\n") : [],
		contextHeadings: [
			...(await headings(join(root, "CONTEXT.md"))),
			...(await headings(join(root, "AGENTS.md"))),
		],
		recentDocs: await listRecentDocs(root),
		warnings,
	};
}
```

- [ ] **Step 4: Run tests and verify GREEN**

```bash
cd /home/osmarg/Code/pi-resume
npm test -- test/resume-scan.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/osmarg/Code/pi-resume
git add extensions/lib/file-writer.ts extensions/lib/resume-scan.ts test/resume-scan.test.mjs
git commit -m "feat: scan resume state"
```

---

### Task 6: Render RESUME.md and redefine `/orgm-resume`

**Files:**
- Create: `/home/osmarg/Code/pi-resume/extensions/lib/resume-renderer.ts`
- Modify: `/home/osmarg/Code/pi-resume/extensions/resume.ts`
- Modify: `/home/osmarg/Code/pi-resume/test/package-shape.test.mjs`
- Create: `/home/osmarg/Code/pi-resume/test/resume-command.test.mjs`
- Modify: `/home/osmarg/Code/pi-resume/README.md`

- [ ] **Step 1: Write failing tests**

Modify `/home/osmarg/Code/pi-resume/test/package-shape.test.mjs`:

```js
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("package ships orgm resume commands", () => {
  assert.equal(pkg.name, "pi-resume");
  assert.deepEqual(pkg.pi.extensions, ["./extensions/resume.ts"]);
  assert.ok(pkg.peerDependencies["@earendil-works/pi-coding-agent"]);
  assert.ok(pkg.peerDependencies["@earendil-works/pi-tui"]);
  assert.ok(existsSync("extensions/resume.ts"));
  const source = readFileSync("extensions/resume.ts", "utf8");
  assert.match(source, /registerCommand\("orgm-resume"/);
  assert.match(source, /RESUME\.md/);
  assert.match(source, /registerCommand\("orgm-session-resume"/);
  assert.doesNotMatch(source, /registerCommand\("(?!orgm-)/);
});
```

Create `/home/osmarg/Code/pi-resume/test/resume-command.test.mjs`:

```js
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import resumeExtension from "../extensions/resume.ts";

const execFileAsync = promisify(execFile);

test("/orgm-resume writes RESUME.md handoff", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-resume-command-"));
  try {
    await execFileAsync("git", ["init"], { cwd: dir });
    await execFileAsync("git", ["config", "user.email", "test@example.com"], { cwd: dir });
    await execFileAsync("git", ["config", "user.name", "Test"], { cwd: dir });
    await writeFile(join(dir, "README.md"), "# Fixture\n");
    await execFileAsync("git", ["add", "README.md"], { cwd: dir });
    await execFileAsync("git", ["commit", "-m", "initial"], { cwd: dir });
    await writeFile(join(dir, "dirty.txt"), "work\n");

    const commands = new Map();
    resumeExtension({ registerCommand(name, definition) { commands.set(name, definition); } });
    await commands.get("orgm-resume").handler("", {
      cwd: dir,
      ui: { notify() {} },
      waitForIdle: async () => {},
      sessionManager: { getSessionFile: () => null },
      switchSession: async () => ({ cancelled: false })
    });
    const text = await readFile(join(dir, "RESUME.md"), "utf8");
    assert.match(text, /# Resume Context/);
    assert.match(text, /## Current Branch and Commits/);
    assert.match(text, /initial/);
    assert.match(text, /dirty.txt/);
    assert.match(text, /## Suggested First Prompt/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run tests and verify RED**

```bash
cd /home/osmarg/Code/pi-resume
npm test -- test/package-shape.test.mjs test/resume-command.test.mjs
```

Expected: FAIL because `/orgm-resume` still opens picker and no renderer exists.

- [ ] **Step 3: Implement renderer**

Create `/home/osmarg/Code/pi-resume/extensions/lib/resume-renderer.ts`:

```ts
import type { ResumeState } from "./resume-scan.ts";

function list(items: string[]): string {
	return items.length ? items.map((item) => `- ${item}`).join("\n") : "- None";
}

export function renderResumeMarkdown(state: ResumeState, now = new Date()): string {
	return `# Resume Context

## Timestamp

${now.toISOString()}

## Current Branch and Commits

- Branch: \`${state.branch}\`

${list(state.recentCommits)}

## Dirty Files

${list(state.dirtyFiles)}

## Recent Decisions

${state.contextHeadings.length ? `Known context headings: ${state.contextHeadings.map((heading) => `\`${heading}\``).join(", ")}` : "- No CONTEXT.md or AGENTS.md headings detected."}

## Completed Work

- Review recent commits above.

## In Progress

${state.dirtyFiles.length ? "- Dirty files indicate active work. Review them before editing." : "- No dirty files detected."}

## Blockers

${state.warnings.length ? list(state.warnings) : "- None detected."}

## Next Steps

- Read \`CONTEXT.md\` and \`AGENTS.md\` if present.
- Review dirty files and latest commits.
- Run targeted verification before claiming completion.

## Verification Status

- Verification not run by \`/orgm-resume\`; run project-specific tests before completion.

## Suggested First Prompt

Continue from \`RESUME.md\`: inspect dirty files, review latest commits, and proceed with the next unchecked task.

## Recent Docs

${list(state.recentDocs)}
`;
}
```

- [ ] **Step 4: Modify `resume.ts`**

Update `/home/osmarg/Code/pi-resume/extensions/resume.ts`:

- Add imports:

```ts
import { join } from "node:path";
import { writeManagedMarkdown } from "./lib/file-writer.ts";
import { renderResumeMarkdown } from "./lib/resume-renderer.ts";
import { scanResumeState } from "./lib/resume-scan.ts";
```

- Register new `/orgm-resume` before session picker:

```ts
	pi.registerCommand("orgm-resume", {
		description: "Generate ORGM RESUME.md handoff for this project",
		handler: async (_args, ctx) => {
			const state = await scanResumeState(ctx.cwd);
			await writeManagedMarkdown(join(ctx.cwd, "RESUME.md"), renderResumeMarkdown(state));
			ctx.ui.notify("ORGM resume handoff updated: RESUME.md", "success");
		},
	});
```

- Rename old session picker command:

```ts
	pi.registerCommand("orgm-session-resume", {
		description: "Open saved session picker and switch to a selected session",
```

- [ ] **Step 5: Run tests and verify GREEN**

```bash
cd /home/osmarg/Code/pi-resume
npm test
npm run pack:check
PI_OFFLINE=1 pi --no-extensions -e /home/osmarg/Code/pi-resume --list-models
```

Expected: tests pass, pack dry-run succeeds, smoke has no stderr.

- [ ] **Step 6: Commit and push**

```bash
cd /home/osmarg/Code/pi-resume
git add extensions test README.md
git commit -m "feat: generate resume handoff"
git push origin main
```

---

### Task 7: Refresh bundle and command namespace audit

**Files:**
- Modify: `/home/osmarg/Code/pi-harness/package-lock.json`
- Modify: `/home/osmarg/Code/pi-harness/README.md` if command descriptions changed

- [ ] **Step 1: Refresh package locks**

Run:

```bash
cd /home/osmarg/Code/pi-harness
npm update pi-init pi-resume --package-lock-only
```

Expected: lock refs point to latest `pi-init` and `pi-resume` commits.

- [ ] **Step 2: Run bundle verification**

Run:

```bash
cd /home/osmarg/Code/pi-harness
node --test tests/harness-bundle-only.test.mjs
npm run pack:check
PI_OFFLINE=1 pi --no-extensions -e /home/osmarg/Code/pi-harness --list-models
```

Expected: tests pass, pack succeeds, smoke has no stderr.

- [ ] **Step 3: Install only harness and verify**

Run:

```bash
pi install git:github.com/osmargm1202/pi-harness
INST=/home/osmarg/.pi/agent/git/github.com/osmargm1202/pi-harness
PI_OFFLINE=1 pi --no-extensions -e "$INST" --list-models
pi list
```

Expected: direct ORGM install list includes only `git:github.com/osmargm1202/pi-harness`.

- [ ] **Step 4: Run command namespace audit**

Run:

```bash
node - <<'NODE'
const fs=require('fs'), path=require('path');
const root='/home/osmarg/.pi/agent/git/github.com/osmargm1202/pi-harness';
const re=/registerCommand\(\s*["'`]([^"'`]+)["'`]/g;
const rows=[];
function walk(dir){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    if(['.git','test','tests'].includes(ent.name)) continue;
    const p=path.join(dir,ent.name);
    if(ent.isDirectory()) walk(p);
    else if(/\.(ts|js|mjs)$/.test(ent.name)){
      const s=fs.readFileSync(p,'utf8');
      for(const m of s.matchAll(re)) rows.push({file:p.slice(root.length+1),name:m[1]});
    }
  }
}
walk(root);
const bad=rows.filter(r=>!r.name.startsWith('orgm-'));
console.log(rows.sort((a,b)=>a.name.localeCompare(b.name)).map(r=>`${r.name}\t${r.file}`).join('\n'));
console.log(`NON_ORGM ${bad.length}`);
if (bad.length) process.exit(1);
NODE
```

Expected: `NON_ORGM 0`.

- [ ] **Step 5: Commit**

```bash
cd /home/osmarg/Code/pi-harness
git add README.md package-lock.json
git commit -m "chore: refresh init resume context generators"
git push origin main
```

---

## Self-Review

Spec coverage:

- `/orgm-init` creates/updates `CONTEXT.md` and `AGENTS.md`: Task 4.
- `/orgm-config-init` preserves old config init: Task 4.
- `/orgm-resume` creates/updates `RESUME.md`: Task 6.
- old session picker renamed `/orgm-session-resume`: Task 6.
- managed section write strategy: Task 1 and Task 5.
- bounded scanner: Task 2 and Task 5.
- render required sections: Task 3 and Task 6.
- bundle lock and command audit: Task 7.

Placeholder scan:

- No placeholder markers or incomplete sections.
- Every code-producing step includes concrete code.
- Every verification step has exact command and expected result.

Type consistency:

- `writeManagedMarkdown`, `scanRepository`, `renderContextMarkdown`, `renderAgentsMarkdown`, `scanResumeState`, `renderResumeMarkdown` names are consistent across tests and implementation.
- Commands are consistently `/orgm-init`, `/orgm-config-init`, `/orgm-resume`, `/orgm-session-resume`.
