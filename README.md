# pi-harness

Public Pi harness package containing ORGM Pi extensions, prompt templates, themes, assets, helper libraries, and widget-related harness pieces used by osmargm1202.

## Contents

- `extensions/` — Pi extensions for ORGM commands, TODOs, ask helpers, notifications, limits, title/footer widgets, agent status, awareness, sessions, git helpers, and subagent deployment.
- `extensions/mode.ts.disabled` — archived mode extension. It is intentionally not loadable.
- `archive/subagents/` — archived bundled subagent prompts kept for reference, not exposed as package workers.
- `prompts/` — reusable prompt templates.
- `themes/` — Pi theme JSON files.
- `lib/` — shared helper libraries for extensions when needed.

## Default behavior

This harness now starts in normal Pi behavior. There is no bundled `/mode` runtime, no mode prompt injection, and no packaged skills.

Skills should be installed directly into the user/project agent environment instead of being bundled by this package.

## TODOs

The TODO extension is enabled by default.

Visible TODO lists are intentionally small:

- Maximum collapsed list size: 5.
- Unfinished tasks appear first, ordered by task number.
- Completed tasks appear last, ordered by task number.
- Deleted tasks only appear when explicitly included, and then stay at the end.

## Subagents

Bundled subagents are archived, not active package assets.

`deploy_agent` can still use local project/user subagents from:

```text
.pi/assets/subagents/
.pi/agent/assets/subagents/
~/.pi/agent/assets/subagents/
```

`teams.yaml` and `query_team` are intentionally removed. Subagent use is direct and explicit through `deploy_agent`.

## Removed legacy flow

This simplified harness removes the previous active primary-agent selector, automatic primary routing, repo tree injection, spec viewer, SDD init/preflight extension, teams, VoltAgent agent folders, mode runtime, packaged subagents, and bundled skills.

Removed or disabled active pieces include:

- `extensions/mode.ts` → `extensions/mode.ts.disabled`
- `assets/subagents/` → `archive/subagents/`
- `skills/`
- `extensions/agent-selector.ts`
- `extensions/spec-dis.ts`
- `extensions/repo-index.ts`
- `extensions/sdd-init.ts`
- `extensions/lib/primary-auto.ts`
- `extensions/lib/repo-tree.ts`
- `lib/sdd-preflight.ts`
- `agents/teams.yaml`
- `agents/01-*` through `agents/10-*`
- `agents/pi-orchestrator/`
- `agents/sdd-orchestrator/`

## Install

Review the repository contents before installing. Pi packages can install executable extensions and prompt/theme configuration, so only install code you trust.

```bash
pi install git:github.com/osmargm1202/pi-harness
```

If this repository is later published to npm as `@osmargm1202/pi-harness`, install it with:

```bash
pi install npm:@osmargm1202/pi-harness
```

Pi package discovery loads package `extensions/`, `prompts`, and `themes` through `package.json`.

## Security note

This package is intended to be public, but it should still be reviewed before publication or installation to ensure it contains no secrets, local-only credentials, private host paths that should not be shared, or unsafe extension behavior.
