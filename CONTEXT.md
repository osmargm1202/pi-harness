<!-- ORGM:BEGIN generated -->
# Project Context

## Overview

`@osmargm1202/pi-harness` is the ORGM Pi bundle/meta-package at `/home/osmarg/Code/pi-harness`.

Primary job: let users install one Pi package and receive the full ORGM Pi stack. It is intentionally bundle-only now: it pins compatible ORGM packages, exposes their Pi resources through `node_modules/...` manifest paths, and keeps only small stack-level prompt templates locally.

User install path:

```bash
pi install git:github.com/osmargm1202/pi-harness
```

Selective installs remain valid for focused packages such as `pi-footer`, `pi-themes`, and `pi-subagents`.

## Current Stack

- Node.js package with npm lockfile (`package-lock.json`, lockfileVersion 3).
- Pi package manifest in `package.json` (`pi.extensions`, `pi.prompts`, `pi.themes`).
- Node built-in test runner via `node:test` for local bundle-shape tests.
- GitHub dependencies for ORGM packages (`github:osmargm1202/...`).
- No local TypeScript build step, `tsconfig.json`, or runtime extension source in this repo.

## Repository Map

- `package.json` — package identity, dependencies, Pi resource manifest, and `pack:check` script.
- `package-lock.json` — pinned installed GitHub dependency refs for bundled ORGM packages.
- `README.md` — user-facing bundle install docs, package boundaries, and security note.
- `prompts/` — only local Pi resources kept here (`gcl`, `gis`, `gpr`, `gwr` prompt templates).
- `tests/harness-bundle-only.test.mjs` — asserts harness stays bundle-only and loads `pi-banner`.
- `openspec/config.yaml` — SDD/TDD config; says focused test runner is `bun test <test-file>`.
- `docs/superpowers/specs/` and `docs/superpowers/plans/` — historical design/plan docs for package split, pi-init/pi-resume context generation, and related work.
- `CONTEXT.md`, `AGENTS.md`, `RESUME.md` — generated/project context files used by ORGM agents.

Ignored/local-only paths:

- `node_modules/` — runtime dependency install output.
- `.worktrees/` — local git worktrees.
- `.superpowers/` — local brainstorming state.
- `.pi-cache/`, `*.log` — local/generated cache and logs.

## Architecture / Ownership

### `pi-harness` owns

- Bundle/meta-package dependency graph for ORGM Pi packages.
- Top-level Pi manifest entries that load resources from installed subpackages:
  - extensions from `node_modules/pi-*/extensions`
  - themes from `node_modules/pi-themes/themes`
  - subagent prompts from `node_modules/pi-subagents/agents`
- Local stack-level prompt templates in `prompts/`.
- Documentation of package boundaries and installation path.

### Focused package owners

- `pi-mem` — local memory/context index provider.
- `pi-caveman` — caveman runtime and shared state events.
- `pi-footer` — Zentui editor/footer UI, ORGM title/caveman display, timer, skill hook status.
- `pi-themes` — ORGM theme JSON resources.
- `pi-subagents` — subagent prompts, deployment extension, and agent-status widgets.
- `pi-awareness` — awareness banner/status behavior.
- `pi-notify` — desktop/system notification behavior.
- `pi-init` — `/orgm-init` context generation and `/orgm-config-init` config initialization.
- `pi-resume` — `/orgm-resume` handoff generation and `/orgm-session-resume` session switch helper.
- `pi-clear` — clear/reset helper commands.
- `pi-limit` — `/orgm-limits` command and limit reporting helpers.
- `pi-title` — title state/generation package and `/orgm-title`.
- `pi-ask` — ask/wrap command package and `ask_user_question` tool.
- `pi-todo` — TODO command/state package and `todo` tool.
- `pi-banner` — ORGM header/control plane (`/orgm-*`) and banner scaffold package.

### Boundaries not to violate

- Do not reintroduce local runtime extensions in `pi-harness` (`./extensions`, `extensions/git.ts`, `extensions/orgm.ts`).
- Do not move footer/editor rendering into `pi-harness` or `pi-banner`; it belongs in `pi-footer`.
- Do not move title generation/state into `pi-footer`; it belongs in `pi-title`.
- Do not move themes, subagents, memory, caveman, init/resume, ask/todo, limits, clear, notify, or awareness implementation back into this repo.
- Keep slash commands under `/orgm-*` across bundled packages.

## Commands

Install dependencies:

```bash
npm install
```

Focused bundle-shape test:

```bash
node --test tests/harness-bundle-only.test.mjs
```

Package dry run:

```bash
npm run pack:check
```

Bundle install smoke:

```bash
pi install git:github.com/osmargm1202/pi-harness
pi list
```

Non-interactive Pi load smoke:

```bash
PI_OFFLINE=1 pi --no-extensions -e /home/osmarg/Code/pi-harness --list-models
```

Notes:

- `package.json` currently has only `pack:check`; there is no `npm test` script.
- `openspec/config.yaml` names `bun test <test-file>` as focused runner, but the checked-in test uses Node's built-in test APIs and can be run directly with `node --test`.

## Configuration and Data

- `package.json` controls published files. Current `files` are `prompts` and `README.md`; docs/tests/context files are source-repo metadata, not package payload.
- `package-lock.json` records exact dependency snapshots from GitHub packages. Refresh it when ORGM package dependency refs change.
- `README.md` is authoritative user-facing package-boundary docs.
- `openspec/config.yaml` defines SDD/TDD expectations for plan-driven work.
- `CONTEXT.md` is durable project context; `AGENTS.md` is agent instruction; `RESUME.md` is active handoff when present.

## Conventions

- Use ORGM slash command namespace: `/orgm-*`.
- Keep `pi-harness` small and bundle-only; new behavior belongs in focused packages.
- Use TDD for behavior changes in focused packages. For this repo, write/adjust shape tests before changing bundle manifest behavior.
- Prefer small commits after green verification.
- Do not stage unrelated generated/local files.
- Preserve manual content outside `<!-- ORGM:BEGIN generated -->` / `<!-- ORGM:END generated -->` sections.

## Current Roadmap / Phases

- Bundle split has reached the `pi-harness` bundle/meta-package state: local agents/themes/extensions have been extracted.
- Current maintenance phase: keep bundle dependency graph, lockfile, manifest paths, README, and shape tests aligned with focused ORGM package ownership.
- Recent context-generation phase: `pi-init`/`pi-resume` own `CONTEXT.md`, `AGENTS.md`, and `RESUME.md` generation; `pi-harness` only depends on and loads those packages.
- Future package work should happen in the focused package repo first, then update this harness dependency/lock/README if the bundle composition changes.

## Do Not Rediscover

- `pi-harness` is not the owner of large features anymore; it is the ORGM distro package.
- It should not ship local runtime extensions directly. `tests/harness-bundle-only.test.mjs` enforces this.
- Local resources kept here are limited to `prompts/` and `README.md` in the package tarball.
- Bundled dependencies currently include: `pi-mem`, `pi-caveman`, `pi-footer`, `pi-themes`, `pi-subagents`, `pi-awareness`, `pi-notify`, `pi-clear`, `pi-title`, `pi-ask`, `pi-todo`, `pi-banner`, `pi-limit`, `pi-init`, `pi-resume`.
- Peer dependencies on `@earendil-works/pi-*` and `typebox` are optional because Pi runtime provides them.
- If a bundled command/tool breaks, inspect the focused package that owns it before changing `pi-harness`.
<!-- ORGM:END generated -->
