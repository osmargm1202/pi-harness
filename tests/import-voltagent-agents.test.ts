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
