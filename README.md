# pi-harness

Public ORGM Pi base/compat package containing ORGM commands, prompt templates, themes, assets, and helper libraries used by osmargm1202. Editor/footer UI belongs in the coupled `pi-footer` package.

## Contents

- `extensions/` — Pi extensions for ORGM commands, TODOs, ask helpers, notifications, title state, agent status, awareness, sessions, git helpers, and subagent deployment. Editor/footer UI is intentionally delegated to `pi-footer`.
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

Standalone install:

```bash
pi install git:github.com/osmargm1202/pi-harness
```

Recommended ORGM stack install:

```bash
for pkg in pi-mem pi-caveman pi-harness pi-footer; do
  pi install git:github.com/osmargm1202/$pkg
done
```

Future npm form:

```bash
for pkg in pi-mem pi-caveman pi-harness pi-footer; do
  pi install npm:@osmargm1202/$pkg
done
```

Pi package discovery loads package `extensions/`, `prompts`, and `themes` through `package.json`.

## ORGM Pi stack

This package is part of the ORGM Pi extension stack.

Packages:

- `pi-mem`: local memory/context index provider.
- `pi-caveman`: caveman runtime and shared state events.
- `pi-harness`: ORGM commands, config, title, ask/todo/banner bridge.
- `pi-footer`: Zentui-based editor/footer UI that displays ORGM status.

## Coupled integrations

Produces:

- ORGM config commands and defaults.
- Title state events/session entries consumed by `pi-footer`.
- Ask/todo/banner bridge behavior until these packages are split out.

Consumes:

- `pi-mem` context payloads for ORGM banner/header integrations.
- `pi-caveman` state where ORGM UI/status integrations need caveman runtime state.
- `pi-footer` is expected to own editor/footer rendering.

Hard dependencies:

- None. `pi-harness` can load alone.

Soft dependencies:

- `pi-mem` improves memory/context banner data.
- `pi-caveman` provides caveman runtime state.
- `pi-footer` provides the primary Zentui-style editor/footer UI.

## Package split roadmap

Future independent packages:

- `pi-ask`
- `pi-todo`
- `pi-banner`
- `pi-title` if title grows beyond shared state/bridge responsibilities

`pi-harness` should become a smaller ORGM base/compat layer as those packages split out.

## Security note

This package is intended to be public, but it should still be reviewed before publication or installation to ensure it contains no secrets, local-only credentials, private host paths that should not be shared, or unsafe extension behavior.
