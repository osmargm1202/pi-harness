import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	buildManifest,
	convertAgentMarkdown,
	ensureManagedCategoryDir,
	filterAgentEntries,
	generateCategoryRouter,
	mergeTeamsYaml,
	parseFrontmatter,
	resolveRootDirArg,
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

const filteredUnsupportedTools = convertAgentMarkdown(
	`---
name: researcher
description: "Tool filtering regression."
tools: Read, Task, WebFetch, Glob
---
You investigate.
`,
	"researcher.md",
);
assert.match(filteredUnsupportedTools, /tools: read, find/);
assert.doesNotMatch(filteredUnsupportedTools, /task/);
assert.doesNotMatch(filteredUnsupportedTools, /webfetch/);

const defaultToolsFallback = convertAgentMarkdown(
	`---
name: analyst
description: "Missing tools regression."
model: sonnet
---
You analyze.
`,
	"analyst.md",
);
assert.match(defaultToolsFallback, /tools: read, grep, find/);

const router = generateCategoryRouter({
	categorySlug: "01-core-development",
	categoryTitle: "Core Development",
	members: ["backend-developer", "frontend-developer"],
});
assert.match(router, /name: 01-core-development/);
assert.match(router, /team: "01-core-development"/);
assert.match(router, /tools: read, grep, find, ls, bash, query_team, deploy_agent/);
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

const mergedWithoutStaleManagedTeams = mergeTeamsYaml(
	`01-core-development:\n  - backend-developer\n\n02-language-specialists:\n  - python-pro\n\npi-orchestrator:\n  - ext-expert\n`,
	new Map([
		["01-core-development", ["fullstack-engineer"]],
	]),
);
assert.match(mergedWithoutStaleManagedTeams, /01-core-development:\n  - fullstack-engineer/);
assert.doesNotMatch(mergedWithoutStaleManagedTeams, /02-language-specialists:/);
assert.match(mergedWithoutStaleManagedTeams, /pi-orchestrator:\n  - ext-expert/);

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

const agentsRoot = mkdtempSync(join(tmpdir(), "voltagent-import-"));
const agentsDir = join(agentsRoot, "agents");
mkdirSync(join(agentsDir, "01-core-development"), { recursive: true });

assert.throws(
	() => ensureManagedCategoryDir(agentsDir, "01-core-development"),
	(error) => {
		assert.match(String(error), /Refusing to overwrite existing VoltAgent category directory/);
		assert.match(String(error), /agents\/voltagent-manifest\.json/);
		assert.match(String(error), /01-core-development/);
		return true;
	},
);

const manifestRoot = mkdtempSync(join(tmpdir(), "voltagent-import-"));
const manifestAgentsDir = join(manifestRoot, "agents");
const managedCategoryDir = join(manifestAgentsDir, "01-core-development");
mkdirSync(managedCategoryDir, { recursive: true });
writeFileSync(
	join(manifestAgentsDir, "voltagent-manifest.json"),
	`${JSON.stringify(buildManifest(new Map([["01-core-development", ["backend-developer"]]])), null, 2)}\n`,
);
ensureManagedCategoryDir(manifestAgentsDir, "01-core-development");
assert.equal(existsSync(managedCategoryDir), false, "managed category dir should be removed before overwrite");

const emptyRoot = mkdtempSync(join(tmpdir(), "voltagent-import-"));
ensureManagedCategoryDir(join(emptyRoot, "agents"), "01-core-development");

assert.equal(
	resolveRootDirArg(["bun", "scripts/import-voltagent-agents.ts", "."], "/tmp/worktree"),
	".",
	"explicit CLI root arg should win over cwd",
);
assert.equal(
	resolveRootDirArg(["bun", "scripts/import-voltagent-agents.ts"], "/tmp/worktree"),
	"/tmp/worktree",
	"cwd should be fallback when CLI root arg missing",
);
