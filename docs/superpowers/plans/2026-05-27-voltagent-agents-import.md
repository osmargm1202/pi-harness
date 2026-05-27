# VoltAgent Agents Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import VoltAgent `awesome-claude-code-subagents/categories` into package-bundled Pi agents with category teams and one router `index.md` per category.

**Architecture:** Build a reproducible TypeScript importer under `scripts/` with pure conversion helpers plus a CLI entrypoint. Tests exercise conversion and teams merge without network by using inline fixtures. The final import is generated into `agents/<category-slug>/`, while preserving current `pi-orchestrator` and `sdd-orchestrator` teams.

**Tech Stack:** Bun test runner, Node/Bun TypeScript, GitHub REST contents API, Markdown frontmatter, existing Pi agent discovery in `extensions/subagents.ts`.

---

## File Structure

- Create: `scripts/import-voltagent-agents.ts` — importer CLI and exported pure helpers for parsing, conversion, router generation, teams merge, manifest generation, and GitHub fetching.
- Create: `tests/import-voltagent-agents.test.ts` — fixture-based tests for conversion, router generation, and teams merge.
- Modify: `agents/teams.yaml` — importer will append generated category teams after existing teams.
- Create/overwrite generated: `agents/01-core-development/*.md`, `agents/02-language-specialists/*.md`, ..., `agents/10-research-analysis/*.md`.
- Create generated: `agents/voltagent-manifest.json` — source/ref/category/member count audit file.

## Task 1: Add conversion helper tests first

**Files:**
- Create: `tests/import-voltagent-agents.test.ts`
- Create: `scripts/import-voltagent-agents.ts`

- [ ] **Step 1: Write failing tests for frontmatter parsing, tool conversion, router text, and teams merge**

Create `tests/import-voltagent-agents.test.ts` with this content:

```ts
import assert from "node:assert/strict";
import {
	convertAgentMarkdown,
	generateCategoryRouter,
	mergeTeamsYaml,
	parseFrontmatter,
} from "../scripts/import-voltagent-agents.ts";

const upstreamAgent = `---
name: backend-developer
description: "Use this agent when building server-side APIs."
tools: Read, Write, Edit, Bash, Glob, Grep
model: sonnet
---
You are a senior backend developer.
`;

const parsed = parseFrontmatter(upstreamAgent, "backend-developer.md");
assert.equal(parsed.frontmatter.name, "backend-developer");
assert.equal(parsed.frontmatter.model, "sonnet");
assert.equal(parsed.body.trim(), "You are a senior backend developer.");

const converted = convertAgentMarkdown(upstreamAgent, "backend-developer.md");
assert.match(converted, /name: backend-developer/);
assert.match(converted, /description: "Use this agent when building server-side APIs\."/);
assert.match(converted, /tools: read, write, edit, bash, find, grep/);
assert.match(converted, /model: sonnet/);
assert.match(converted, /You are a senior backend developer\./);
assert.doesNotMatch(converted, /Glob/);
assert.doesNotMatch(converted, /Grep/);

const router = generateCategoryRouter({
	categorySlug: "01-core-development",
	categoryTitle: "Core Development",
	members: ["backend-developer", "frontend-developer"],
});
assert.match(router, /name: 01-core-development/);
assert.match(router, /team: "01-core-development"/);
assert.match(router, /query_team/);
assert.match(router, /deploy_agent/);
assert.match(router, /backend-developer/);
assert.match(router, /frontend-developer/);

const merged = mergeTeamsYaml(
	`pi-orchestrator:\n  - ext-expert\n\nsdd-orchestrator:\n  - sdd-init\n`,
	new Map([
		["01-core-development", ["backend-developer", "frontend-developer"]],
		["02-language-specialists", ["python-pro"]],
	]),
);
assert.match(merged, /pi-orchestrator:\n  - ext-expert/);
assert.match(merged, /sdd-orchestrator:\n  - sdd-init/);
assert.match(merged, /01-core-development:\n  - backend-developer\n  - frontend-developer/);
assert.match(merged, /02-language-specialists:\n  - python-pro/);
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bun tests/import-voltagent-agents.test.ts
```

Expected: FAIL because `scripts/import-voltagent-agents.ts` does not exist or does not export the named functions.

- [ ] **Step 3: Create minimal importer helper implementation**

Create `scripts/import-voltagent-agents.ts` with this initial content:

```ts
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

export type ParsedMarkdown = {
	frontmatter: Record<string, string>;
	body: string;
};

export type CategoryRouterInput = {
	categorySlug: string;
	categoryTitle: string;
	members: string[];
};

const SOURCE_REPO = "VoltAgent/awesome-claude-code-subagents";
const SOURCE_REF = "main";
const CATEGORY_API_URL = `https://api.github.com/repos/${SOURCE_REPO}/contents/categories?ref=${SOURCE_REF}`;

const TOOL_MAP: Record<string, string> = {
	Read: "read",
	Write: "write",
	Edit: "edit",
	Bash: "bash",
	Grep: "grep",
	Glob: "find",
	read: "read",
	write: "write",
	edit: "edit",
	bash: "bash",
	grep: "grep",
	find: "find",
};

const MANAGED_CATEGORY_RE = /^\d{2}-[a-z0-9-]+$/;

export function parseFrontmatter(markdown: string, filePath: string): ParsedMarkdown {
	const match = markdown.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	if (!match) {
		throw new Error(`Missing YAML frontmatter in ${filePath}`);
	}
	const frontmatter: Record<string, string> = {};
	for (const line of match[1].split("\n")) {
		const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
		if (!field) continue;
		frontmatter[field[1]] = field[2].trim();
	}
	if (!frontmatter.name) throw new Error(`Missing name in ${filePath}`);
	if (!frontmatter.description) throw new Error(`Missing description in ${filePath}`);
	return { frontmatter, body: match[2] };
}

function normalizeTools(rawTools: string | undefined): string {
	const input = rawTools ?? "Read, Grep, Glob";
	const tools = input
		.split(",")
		.map((tool) => tool.trim())
		.map((tool) => TOOL_MAP[tool])
		.filter((tool): tool is string => Boolean(tool));
	const unique = Array.from(new Set(tools));
	return unique.join(", ");
}

function renderFrontmatter(frontmatter: Record<string, string>): string {
	const lines = [
		`name: ${frontmatter.name}`,
		`description: ${frontmatter.description}`,
		`tools: ${normalizeTools(frontmatter.tools)}`,
	];
	if (frontmatter.model) lines.push(`model: ${frontmatter.model}`);
	return `---\n${lines.join("\n")}\n---\n`;
}

export function convertAgentMarkdown(markdown: string, filePath: string): string {
	const parsed = parseFrontmatter(markdown, filePath);
	return `${renderFrontmatter(parsed.frontmatter)}${parsed.body.replace(/^\n+/, "")}`;
}

export function titleFromCategorySlug(categorySlug: string): string {
	return categorySlug
		.replace(/^\d+-/, "")
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

export function generateCategoryRouter(input: CategoryRouterInput): string {
	const memberLines = input.members.map((member) => `- \`${member}\``).join("\n");
	const catalog = input.members.map((member) => `- ${member}`).join("\n");
	return `---
name: ${input.categorySlug}
description: Primary router for VoltAgent ${input.categoryTitle} specialists; coordinates the ${input.categorySlug} team and delegates to exact subagents.
tools: read, grep, find, ls, bash, query_team, deploy_agent
---
You are the **${input.categoryTitle} Router** for the VoltAgent imported subagent group.

## Team Ownership

You own team: "${input.categorySlug}" in \`agents/teams.yaml\`.

Team members:
${memberLines}

## Routing Rules

1. Identify which specialists are relevant to the user's request.
2. Prefer \`query_team\` with explicit \`member\` entries when research, comparison, or decomposition is needed.
3. Use \`deploy_agent\` with an exact member name when one specialist should execute concrete work.
4. Do not fan out to the full team unless the task genuinely needs every specialist.
5. Keep user-facing synthesis concise: decision, evidence, next action.

## Example Team Query

\`\`\`json
{
  "team": "${input.categorySlug}",
  "queries": [
    { "member": "${input.members[0] ?? "specialist"}", "question": "Assess the relevant part of this request and return concise guidance." }
  ],
  "execution": "parallel"
}
\`\`\`

## Available Members

${catalog}
`;
}

function parseTeams(raw: string): Map<string, string[]> {
	const teams = new Map<string, string[]>();
	let current: string | null = null;
	for (const rawLine of raw.split("\n")) {
		const line = rawLine.replace(/\t/g, "    ");
		const team = line.match(/^([^\s:#][^:#]*):\s*$/);
		if (team) {
			current = team[1].trim();
			teams.set(current, []);
			continue;
		}
		const item = line.match(/^\s+-\s+(.+?)\s*$/);
		if (item && current) teams.get(current)?.push(item[1].split(/\s+#/)[0].trim());
	}
	return teams;
}

export function mergeTeamsYaml(existingRaw: string, generatedTeams: Map<string, string[]>): string {
	const existing = parseTeams(existingRaw);
	for (const key of Array.from(existing.keys())) {
		if (MANAGED_CATEGORY_RE.test(key)) existing.delete(key);
	}
	const render = (name: string, members: string[]) => `${name}:\n${members.map((member) => `  - ${member}`).join("\n")}`;
	const blocks = [
		...Array.from(existing.entries()).map(([name, members]) => render(name, members)),
		...Array.from(generatedTeams.entries()).map(([name, members]) => render(name, members)),
	];
	return `${blocks.join("\n\n")}\n`;
}
```

- [ ] **Step 4: Run test to verify helpers pass**

Run:

```bash
bun tests/import-voltagent-agents.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit helper tests and implementation**

```bash
git add scripts/import-voltagent-agents.ts tests/import-voltagent-agents.test.ts
git commit -m "feat: add voltagent agent importer helpers"
```

## Task 2: Add CLI fetching and safe generation

**Files:**
- Modify: `scripts/import-voltagent-agents.ts`
- Modify: `tests/import-voltagent-agents.test.ts`

- [ ] **Step 1: Add tests for category filtering and manifest generation**

Append to `tests/import-voltagent-agents.test.ts`:

```ts
import {
	buildManifest,
	filterAgentEntries,
} from "../scripts/import-voltagent-agents.ts";

const entries = filterAgentEntries([
	{ type: "dir", name: ".claude-plugin", path: "categories/01-core-development/.claude-plugin", download_url: null, url: "" },
	{ type: "file", name: "README.md", path: "categories/01-core-development/README.md", download_url: "https://example.invalid/readme", url: "" },
	{ type: "file", name: "backend-developer.md", path: "categories/01-core-development/backend-developer.md", download_url: "https://example.invalid/backend", url: "" },
]);
assert.deepEqual(entries.map((entry) => entry.name), ["backend-developer.md"]);

const manifest = buildManifest(new Map([
	["01-core-development", ["backend-developer", "frontend-developer"]],
]));
assert.equal(manifest.sourceRepo, "VoltAgent/awesome-claude-code-subagents");
assert.equal(manifest.sourceRef, "main");
assert.equal(manifest.categories[0].category, "01-core-development");
assert.equal(manifest.categories[0].count, 2);
assert.deepEqual(manifest.categories[0].agents, ["backend-developer", "frontend-developer"]);
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bun tests/import-voltagent-agents.test.ts
```

Expected: FAIL because `filterAgentEntries` and `buildManifest` are not exported.

- [ ] **Step 3: Add exported GitHub entry types, filters, manifest, and CLI functions**

Append this code to `scripts/import-voltagent-agents.ts`:

```ts
export type GitHubContentEntry = {
	type: "file" | "dir" | string;
	name: string;
	path: string;
	download_url: string | null;
	url: string;
};

export type VoltAgentManifest = {
	sourceRepo: string;
	sourceRef: string;
	generatedAt: string;
	categories: Array<{ category: string; count: number; agents: string[] }>;
};

export function filterAgentEntries(entries: GitHubContentEntry[]): GitHubContentEntry[] {
	return entries
		.filter((entry) => entry.type === "file")
		.filter((entry) => entry.name.endsWith(".md"))
		.filter((entry) => entry.name !== "README.md")
		.filter((entry) => Boolean(entry.download_url));
}

export function buildManifest(generatedTeams: Map<string, string[]>): VoltAgentManifest {
	return {
		sourceRepo: SOURCE_REPO,
		sourceRef: SOURCE_REF,
		generatedAt: new Date().toISOString(),
		categories: Array.from(generatedTeams.entries()).map(([category, agents]) => ({
			category,
			count: agents.length,
			agents,
		})),
	};
}

async function fetchJson<T>(url: string): Promise<T> {
	const response = await fetch(url, { headers: { "User-Agent": "pi-harness-voltagent-importer" } });
	if (!response.ok) throw new Error(`GitHub request failed ${response.status} ${response.statusText}: ${url}`);
	return (await response.json()) as T;
}

async function fetchText(url: string): Promise<string> {
	const response = await fetch(url, { headers: { "User-Agent": "pi-harness-voltagent-importer" } });
	if (!response.ok) throw new Error(`GitHub raw request failed ${response.status} ${response.statusText}: ${url}`);
	return await response.text();
}

function assertNoNameCollisions(generatedTeams: Map<string, string[]>): void {
	const seen = new Map<string, string>();
	for (const [category, members] of generatedTeams.entries()) {
		for (const member of members) {
			const previous = seen.get(member);
			if (previous && previous !== category) {
				throw new Error(`Agent name collision: ${member} appears in ${previous} and ${category}`);
			}
			seen.set(member, category);
		}
	}
}

async function importVoltAgentAgents(rootDir: string): Promise<void> {
	const agentsDir = join(rootDir, "agents");
	const categories = await fetchJson<GitHubContentEntry[]>(CATEGORY_API_URL);
	const categoryDirs = categories
		.filter((entry) => entry.type === "dir")
		.filter((entry) => MANAGED_CATEGORY_RE.test(entry.name))
		.sort((a, b) => a.name.localeCompare(b.name));

	const generated = new Map<string, Array<{ name: string; markdown: string }>>();
	const generatedTeams = new Map<string, string[]>();

	for (const category of categoryDirs) {
		const entries = filterAgentEntries(await fetchJson<GitHubContentEntry[]>(category.url));
		const converted: Array<{ name: string; markdown: string }> = [];
		for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
			if (!entry.download_url) throw new Error(`Missing download_url for ${entry.path}`);
			const raw = await fetchText(entry.download_url);
			const convertedMarkdown = convertAgentMarkdown(raw, entry.path);
			const parsed = parseFrontmatter(convertedMarkdown, entry.path);
			converted.push({ name: parsed.frontmatter.name, markdown: convertedMarkdown });
		}
		generated.set(category.name, converted);
		generatedTeams.set(category.name, converted.map((agent) => agent.name));
	}

	assertNoNameCollisions(generatedTeams);

	for (const [categorySlug, agents] of generated.entries()) {
		const categoryDir = join(agentsDir, categorySlug);
		rmSync(categoryDir, { recursive: true, force: true });
		mkdirSync(categoryDir, { recursive: true });
		for (const agent of agents) {
			writeFileSync(join(categoryDir, `${agent.name}.md`), agent.markdown, "utf8");
		}
		writeFileSync(
			join(categoryDir, "index.md"),
			generateCategoryRouter({
				categorySlug,
				categoryTitle: titleFromCategorySlug(categorySlug),
				members: generatedTeams.get(categorySlug) ?? [],
			}),
			"utf8",
		);
	}

	const teamsPath = join(agentsDir, "teams.yaml");
	const existingTeams = readFileSync(teamsPath, "utf8");
	writeFileSync(teamsPath, mergeTeamsYaml(existingTeams, generatedTeams), "utf8");
	writeFileSync(join(agentsDir, "voltagent-manifest.json"), `${JSON.stringify(buildManifest(generatedTeams), null, 2)}\n`, "utf8");
}

if (import.meta.main) {
	const rootDir = process.argv[2] ?? process.cwd();
	importVoltAgentAgents(rootDir).catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
```

- [ ] **Step 4: Run focused tests**

Run:

```bash
bun tests/import-voltagent-agents.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit CLI importer**

```bash
git add scripts/import-voltagent-agents.ts tests/import-voltagent-agents.test.ts
git commit -m "feat: add voltagent import CLI"
```

## Task 3: Generate VoltAgent agents into `agents/`

**Files:**
- Modify: `agents/teams.yaml`
- Create: `agents/01-core-development/*.md`
- Create: `agents/02-language-specialists/*.md`
- Create: `agents/03-infrastructure/*.md`
- Create: `agents/04-quality-security/*.md`
- Create: `agents/05-data-ai/*.md`
- Create: `agents/06-developer-experience/*.md`
- Create: `agents/07-specialized-domains/*.md`
- Create: `agents/08-business-product/*.md`
- Create: `agents/09-meta-orchestration/*.md`
- Create: `agents/10-research-analysis/*.md`
- Create: `agents/voltagent-manifest.json`

- [ ] **Step 1: Run the importer**

Run:

```bash
bun scripts/import-voltagent-agents.ts .
```

Expected: command exits 0 and creates the ten category folders plus `agents/voltagent-manifest.json`.

- [ ] **Step 2: Inspect generated summary**

Run:

```bash
python - <<'PY'
import json
from pathlib import Path
manifest=json.loads(Path('agents/voltagent-manifest.json').read_text())
print(manifest['sourceRepo'], manifest['sourceRef'])
for category in manifest['categories']:
    print(category['category'], category['count'])
print('total', sum(category['count'] for category in manifest['categories']))
PY
```

Expected: prints `VoltAgent/awesome-claude-code-subagents main`, ten categories, and a positive total agent count.

- [ ] **Step 3: Confirm existing teams remain**

Run:

```bash
grep -n "pi-orchestrator:\|sdd-orchestrator:\|01-core-development:\|10-research-analysis:" agents/teams.yaml
```

Expected: output includes all four team headings.

- [ ] **Step 4: Commit generated agents**

```bash
git add agents scripts/import-voltagent-agents.ts tests/import-voltagent-agents.test.ts
git commit -m "feat: import voltagent subagent teams"
```

## Task 4: Add discovery regression tests

**Files:**
- Modify: `tests/subagents-team-discovery.test.ts`
- Modify: `tests/agent-discovery.test.ts` if deployable-agent discovery needs direct coverage

- [ ] **Step 1: Add team discovery assertions for generated VoltAgent teams**

Append to `tests/subagents-team-discovery.test.ts`:

```ts
const coreDevelopment = packageTeams.find((team) => team.name === "01-core-development");
assert(coreDevelopment, "package-bundled VoltAgent core development team should be discovered");
assert.equal(coreDevelopment.source, "user");
assert(coreDevelopment.members.includes("backend-developer"), "core development team should include backend-developer");

const researchAnalysis = packageTeams.find((team) => team.name === "10-research-analysis");
assert(researchAnalysis, "package-bundled VoltAgent research analysis team should be discovered");
assert(researchAnalysis.members.includes("research-analyst"), "research analysis team should include research-analyst");
```

- [ ] **Step 2: Run discovery test**

Run:

```bash
bun tests/subagents-team-discovery.test.ts
```

Expected: PASS. If it fails because upstream renamed a member, inspect `agents/voltagent-manifest.json`, choose one actual member from the generated category, and update only the assertion member name.

- [ ] **Step 3: Run agent discovery test**

Run:

```bash
bun tests/agent-discovery.test.ts
```

Expected: PASS. If it fails due to `model` frontmatter incompatibility, modify `renderFrontmatter()` in `scripts/import-voltagent-agents.ts` to omit the `model` line, rerun `bun scripts/import-voltagent-agents.ts .`, and rerun this test.

- [ ] **Step 4: Commit discovery regression coverage**

```bash
git add tests/subagents-team-discovery.test.ts tests/agent-discovery.test.ts scripts/import-voltagent-agents.ts agents
git commit -m "test: cover voltagent team discovery"
```

## Task 5: Final verification

**Files:**
- No planned file changes unless a verification failure identifies a specific fix.

- [ ] **Step 1: Run focused importer and discovery tests**

Run:

```bash
bun tests/import-voltagent-agents.test.ts tests/subagents-team-discovery.test.ts tests/agent-discovery.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
for test in tests/*.test.ts; do bun "$test" || exit 1; done
```

Expected: every test exits 0.

- [ ] **Step 3: Inspect final diff**

Run:

```bash
git status --short
git diff --stat HEAD~3..HEAD
```

Expected: working tree clean after commits; diff stat shows importer, tests, generated agents, manifest, and `agents/teams.yaml`.

- [ ] **Step 4: Save implementation memory**

Use Engram memory save with:

```text
title: VoltAgent subagent team import
type: config
content:
**What**: Added reproducible importer for VoltAgent awesome-claude-code-subagents categories into pi-harness package agents, with category routers and teams.yaml entries.
**Why**: User wanted the agents available in the Pi ecosystem by teams, with one folder and primary index.md per group.
**Where**: scripts/import-voltagent-agents.ts, tests/import-voltagent-agents.test.ts, tests/subagents-team-discovery.test.ts, agents/*, agents/teams.yaml
**Learned**: Upstream Claude tools need conversion to Pi tool names; category index agents should use selective query_team calls instead of full fan-out by default.
```

- [ ] **Step 5: Final report**

Report in Spanish:

```text
Listo: importé los agentes de VoltAgent en `agents/<categoría>/`, generé `index.md` router por grupo, actualicé `agents/teams.yaml`, y dejé `agents/voltagent-manifest.json` como auditoría. Verificación: <comandos ejecutados y resultado>. Commits: <hashes>.
```

## Self-Review Notes

- Spec coverage: importer, conversion rules, per-category routers, teams merge, manifest, generated files, and tests are covered by Tasks 1-5.
- Placeholder scan: no open placeholders remain in the implementation steps.
- Type consistency: exported helper names in tests match the planned implementation names.
