# VoltAgent Agents Import Design

## Goal

Import the agent definitions from `VoltAgent/awesome-claude-code-subagents/categories` into `pi-harness` so they are available as versioned Pi agents grouped by team, with one primary `index.md` router per category.

## Context

- Current package agent root: `agents/`.
- Current team registry: `agents/teams.yaml`.
- Existing package discovery already supports package-bundled agents and teams.
- Source repository categories currently include:
  - `01-core-development`
  - `02-language-specialists`
  - `03-infrastructure`
  - `04-quality-security`
  - `05-data-ai`
  - `06-developer-experience`
  - `07-specialized-domains`
  - `08-business-product`
  - `09-meta-orchestration`
  - `10-research-analysis`

## Decisions

1. Install into this repository under `pi-harness/agents/`.
2. Keep upstream agent names unchanged. Do not add a `va-` prefix.
3. Create one team per upstream category.
4. Create one `index.md` primary agent per category folder.
5. Use a lightweight router pattern for each `index.md`: consult specific team members with `query_team` when research/comparison is useful, and use `deploy_agent` for concrete execution.
6. Prefer a reproducible importer over a one-off manual copy.

## Architecture

Add an importer script that reads the upstream GitHub `categories/` tree and generates Pi-compatible files.

Target layout:

```text
agents/
  01-core-development/
    index.md
    backend-developer.md
    frontend-developer.md
    ...
  02-language-specialists/
    index.md
    python-pro.md
    ...
  ...
  teams.yaml
```

Team names match category folder slugs, for example:

```yaml
01-core-development:
  - backend-developer
  - frontend-developer
```

Keeping the numeric category prefix preserves upstream ordering and avoids inventing ambiguous taxonomy names.

## Agent Conversion Rules

For each upstream `.md` agent file:

- Preserve the original `name`.
- Preserve the original `description` text.
- Convert Claude-style tool names to Pi-compatible tool names:
  - `Read` -> `read`
  - `Write` -> `write`
  - `Edit` -> `edit`
  - `Bash` -> `bash`
  - `Grep` -> `grep`
  - `Glob` -> `find`
- Keep only tools available in Pi agent definitions.
- Preserve the prompt body.
- Preserve `model` metadata initially if the existing parser accepts unknown/frontmatter model fields. If tests or discovery reject it, normalize by dropping or mapping it according to existing project conventions.

## Category `index.md` Router Contract

Each generated category `index.md` is the primary agent for that group. It should:

- Declare `name` equal to the category slug.
- Describe itself as the category coordinator.
- Include tools: `read, grep, find, ls, bash, query_team, deploy_agent`.
- State that it owns the matching team in `agents/teams.yaml`.
- Avoid blind team-wide fan-out by default.
- Prefer `query_team` with explicit `member` entries for relevant specialists.
- Use `deploy_agent` by exact agent name for concrete work.
- Synthesize results and keep user-facing output concise.

## Importer Behavior

The importer should:

1. Fetch category directory metadata from GitHub.
2. Ignore `.claude-plugin/` directories and category `README.md` files as deployable agents.
3. Download each agent `.md` file.
4. Parse YAML frontmatter and body.
5. Apply conversion rules.
6. Generate/overwrite only the managed VoltAgent category folders.
7. Merge category teams into `agents/teams.yaml` while preserving existing `pi-orchestrator` and `sdd-orchestrator` teams.
8. Write a manifest that records source repo, ref, category counts, and generated agent names.

## Error Handling

- Network failures should stop the import with a clear message.
- Malformed frontmatter should report the file path and fail rather than generating partial invalid agents silently.
- Name collisions with existing non-VoltAgent agents should be reported before writing.
- Existing generated category folders may be overwritten by the importer; unrelated folders must not be touched.

## Testing and Verification

Add or update tests to cover:

- Tool conversion from Claude names to Pi names.
- Generated category router content includes `query_team`, `deploy_agent`, and the correct team name.
- `teams.yaml` merge preserves existing teams.
- Generated agent files are discoverable by the existing agent discovery helpers.

Manual verification after implementation:

- Run the importer.
- Run the package test suite or targeted agent discovery tests.
- Confirm `agents/teams.yaml` contains existing teams plus all VoltAgent category teams.
- Confirm a sample category index can route to a named member with `query_team`/`deploy_agent` instructions.

## Out of Scope

- Installing into `~/.pi/agent/agents/`.
- Renaming agents with a prefix.
- Creating a global all-category orchestrator.
- Modifying upstream agent prompts beyond Pi compatibility conversion.
- Adding runtime UI selection changes beyond what existing discovery already supports.
