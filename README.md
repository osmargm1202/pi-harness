# pi-harness

Public Pi harness package containing ORGM Pi extensions, mode prompts, deployable subagents, prompt templates, themes, assets, helper libraries, and widget-related harness pieces used by osmargm1202.

## Contents

- `extensions/` — Pi extensions, including mode switching, subagent deployment, agent status, awareness, orgm, and footer/widget helpers. Minimal footer can passively observe `pi-caveman:state` when separate `pi-caveman` package is installed.
- `agents/` — injected mode prompts only: `plan.md`, `build.md`, `ask.md`, `sdd.md`, and `tdd.md`. Default `pi` mode has no prompt file because it leaves Pi normal behavior untouched.
- `assets/subagents/plan/` — deployable Plan Mode worker prompts used by `deploy_agent`.
- `assets/subagents/ask/` — deployable Ask Mode worker prompts used by `deploy_agent`.
- `assets/subagents/build/` — deployable Build Mode worker prompts used by `deploy_agent`.
- `assets/subagents/sdd/` — deployable SDD worker prompts used by `deploy_agent`.
- `assets/subagents/tdd/` — deployable TDD worker prompts used by `deploy_agent`.
- `prompts/` — reusable prompt templates.
- `themes/` — Pi theme JSON files.
- `skills/` — bundled skills.
- `lib/` — shared helper libraries for extensions when needed.

## Modes

`extensions/mode.ts` controls the main ORGM runtime mode.

Default mode on startup: `pi`.

Shortcut cycle:

```text
alt+1: pi → plan → build → ask → sdd → tdd → pi
```

Commands:

```text
/mode
/mode pi
/mode plan
/mode build
/mode ask
/mode sdd
/mode tdd
```

Mode behavior:

- `pi` — default plain Pi mode. No ORGM prompt injection, no active-tool override, and no tool blocking.
- `plan` — research, read, inspect, and write planning artifacts only. Can deploy `planner` for focused planning.
- `ask` — talk/explain; no writes. Can deploy `investigator` for read-only investigation.
- `build` — full implementation mode. Can deploy `builder` for normal builds or `fast_builder` for aplicaciones rápidas with contexto reducido (`openai-codex/gpt-5.3-codex-spark`).
- `sdd` — SDD-oriented coordination with `assets/subagents` workers.
- `tdd` — TDD-oriented coordination with `assets/subagents` workers.

## Subagents

`deploy_agent` discovers packaged workers from:

```text
assets/subagents/
├── plan/
├── ask/
├── build/
├── sdd/
└── tdd/
```

and local project/user overrides from:

```text
.pi/assets/subagents/
.pi/agent/assets/subagents/
~/.pi/agent/assets/subagents/
```

`teams.yaml` and `query_team` are intentionally removed. Subagent use is direct and explicit through `deploy_agent`.

## Removed legacy flow

This simplified harness removes the previous active primary-agent selector, automatic primary routing, repo tree injection, spec viewer, SDD init/preflight extension, teams, and VoltAgent agent folders.

Removed active pieces include:

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

Review the repository contents before installing. Pi packages can install executable extensions and prompt/agent configuration, so only install code you trust.

```bash
pi install git:github.com/osmargm1202/pi-harness
```

If this repository is later published to npm as `@osmargm1202/pi-harness`, install it with:

```bash
pi install npm:@osmargm1202/pi-harness
```

Pi package discovery loads package `extensions/`, `prompts`, `skills`, and `themes` through `package.json`. The `agents/` and `assets/` directories are included so mode prompts and subagents can be referenced by bundled extensions.

## Security note

This package is intended to be public, but it should still be reviewed before publication or installation to ensure it contains no secrets, local-only credentials, private host paths that should not be shared, or unsafe extension behavior.
