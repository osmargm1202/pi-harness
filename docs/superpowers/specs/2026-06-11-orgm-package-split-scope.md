# ORGM Pi Package Split Scope

Date: 2026-06-11

## Goal

Split focused ORGM Pi packages out of `pi-harness` while keeping `pi-harness` as the base/compat package during migration.

## Current stack

Install together:

```bash
for pkg in pi-mem pi-caveman pi-harness pi-footer; do
  pi install git:github.com/osmargm1202/$pkg
done
```

Current roles:

- `pi-mem`: memory/context index provider.
- `pi-caveman`: caveman runtime/state provider.
- `pi-harness`: ORGM compatibility/base package with commands and bridges.
- `pi-footer`: real Zentui fork; editor/footer UI owner.

## Target package boundaries

### `pi-title`

Owns session title state only.

Source candidates:

- `extensions/title.ts`
- `extensions/lib/minimal-title.ts`
- `tests/title.test.ts`

Produces:

- `SESSION_TITLE_ENTRY_TYPE = "session-title"`
- `TITLE_STATE_EVENT = "title:state-changed"`
- manual title commands and title state session entries

Consumes:

- Pi session history/messages

Consumed by:

- `pi-footer` for title display
- `pi-harness` during compatibility period

Rule:

- `pi-title` may generate/update titles.
- `pi-footer` only displays title state and must not generate titles.

### `pi-ask`

Owns ask/wrap command behavior.

Source candidates:

- `extensions/ask.ts`
- `tests/ask-extension-config.test.ts`
- `tests/ask-wrap.test.ts`

Produces:

- Ask helper commands
- Ask config defaults

Consumes:

- Pi command/input APIs
- ORGM config only if required; prefer local package config

### `pi-todo`

Owns TODO command/state behavior.

Source candidates:

- `extensions/todo.ts`
- `tests/todo-auto-review.test.ts`
- `tests/todo-order-limit.test.ts`
- `tests/todo-reset.test.ts`

Produces:

- TODO commands
- TODO session entries/state replay
- auto-review TODO behavior if kept in scope

Consumes:

- Pi session entries/events

### `pi-banner`

Owns ORGM banner/header/widget presentation, not footer.

Source candidates:

- `extensions/minimal.ts` banner/header portions only
- `extensions/awareness.ts`
- `extensions/agent-status.ts`
- `extensions/lib/agent-status-config.ts`
- `extensions/lib/minimal-skill.ts`
- `tests/awareness.test.ts`
- `tests/agent-status-widget.test.ts`
- `tests/minimal-footer-utils.test.ts` only after footer-specific assertions are removed or migrated

Produces:

- startup/header/banner widgets
- memory/context display from `pi-mem:context-index`
- agent status widget/banner if retained

Consumes:

- `pi-mem:context-index`
- `pi-caveman:state`
- package configs for banner visibility

Rule:

- `pi-banner` must not own editor/footer rendering.
- `pi-footer` remains footer owner.

## Final `pi-harness` scope after splits

After `pi-title`, `pi-ask`, `pi-todo`, and `pi-banner` are extracted and smoke-tested, `pi-harness` should keep only base/compat responsibilities:

Keeps:

- ORGM package metadata and install compatibility.
- Shared ORGM constants/types that have not moved into a dedicated package yet.
- Prompt templates, themes, and assets that are truly stack-level.
- Thin compatibility shims that warn or delegate to split packages for one release cycle.
- Stack documentation and migration notes.
- Safety/diagnostic commands that do not belong to a focused split package.

Stops owning:

- Editor/footer rendering: owned by `pi-footer`.
- Title generation/state: owned by `pi-title`.
- Ask/wrap command behavior: owned by `pi-ask`.
- TODO state/commands: owned by `pi-todo`.
- Banner/header/widget presentation: owned by `pi-banner`.
- Memory storage/context retrieval: owned by `pi-mem`.
- Caveman runtime/style state: owned by `pi-caveman`.

Target shape:

- `pi-harness` becomes ORGM base/compat glue, not feature owner.
- New feature code should prefer a focused package first.
- Existing `pi-harness` modules should be removed only after their replacement package is installed, tested, and documented.

## Migration order

1. Create repos with README/package skeletons only.
2. Extract `pi-title` first because `pi-footer` already consumes its public contract.
3. Extract `pi-ask` and `pi-todo` independently.
4. Extract `pi-banner` last because it has the most coupling to memory/caveman/status widgets.
5. Keep compatibility exports/commands in `pi-harness` until replacements are installed and smoke-tested.
6. Remove duplicated harness modules only after each package has tests and install smoke coverage.

## Repo bootstrap checklist

For each new repo:

- `package.json` with `name`, `version`, `type`, `pi.extensions`, scripts.
- `README.md` with standalone install and ORGM stack install loop.
- `extensions/<name>.ts` entrypoint.
- `tests/` copied/adapted from `pi-harness`.
- `node --test` or `bun test` smoke.
- `pi install git:github.com/osmargm1202/<repo>` smoke.

## Open decisions

- Whether `pi-banner` should include `agent-status` or that should become `pi-agent-status` later.
- Whether `pi-title` publishes npm as `pi-title` or scoped `@osmargm1202/pi-title` after GitHub install path is stable.
- Whether `pi-harness` keeps disabled compatibility commands or fully removes extracted modules after one release cycle.
