# Pi Footer Stack Design

## Goal

Create a new `pi-footer` package as a real fork of `lmilojevicc/pi-zentui`, then add only the ORGM-specific status integrations needed by the ORGM Pi stack. Revert the experimental Zentui-style visual implementation from `pi-harness` so `pi-footer` becomes the single owner of editor/footer UI.

## Package Relationship

The ORGM Pi stack is a set of coupled packages that can be maintained independently but work best when installed together.

Recommended install from git:

```bash
for pkg in pi-mem pi-caveman pi-harness pi-footer; do
  pi install git:github.com/osmargm1202/$pkg
done
```

Future npm install form:

```bash
for pkg in pi-mem pi-caveman pi-harness pi-footer; do
  pi install npm:@osmargm1202/$pkg
done
```

## Current Packages

### `pi-mem`

Local memory/context-index provider.

Produces:
- Memory/context index data.
- Header/banner context payloads consumed by ORGM UI packages.

Consumes:
- Session/project context.

### `pi-caveman`

Pi-native caveman runtime.

Produces:
- `PI_CAVEMAN_STATE_EVENT` on the Pi event bus.
- `PI_CAVEMAN_STATE_KEY` session custom entry.
- Runtime caveman state such as `caveman:full` or `caveman:off`.

Consumes:
- User config and command state.

### `pi-harness`

ORGM compatibility/base package.

Current responsibilities:
- ORGM config.
- Title generation/state.
- Ask/todo/banner/header utilities until they are split out.
- Package integration bridge for older ORGM commands.

Produces:
- Title state events and session entries.
- Banner/header events while `pi-banner` does not exist.
- Ask/todo command behavior while those packages are not split out.

Consumes:
- `pi-mem` context payloads for banner/header.
- `pi-caveman` state where needed.

### `pi-footer`

New repo and package. Real fork of `lmilojevicc/pi-zentui`.

Responsibilities:
- Preserve Zentui visual behavior: Opencode-style editor and Starship-style footer/statusline.
- Add ORGM status integrations without rewriting the Zentui visual model.

Produces:
- Footer/editor UI.

Consumes:
- `pi-caveman` shared state for caveman display.
- `pi-harness` title state for title display.
- Third-party statuses from `ctx.ui.setStatus()`.

## Future Package Split

Split these from `pi-harness` later:

- `pi-ask`
- `pi-todo`
- `pi-banner`
- `pi-title` if title grows beyond bridge/state responsibilities

Each future repo should have:
- Independent README.
- Independent tests.
- Independent package metadata.
- Clear `Produces` / `Consumes` / `Hard dependencies` / `Soft dependencies` sections.

## `pi-footer` Scope

Base repo:
- Fork `lmilojevicc/pi-zentui` into `osmargm1202/pi-footer`.

Package rename:
- `name`: `pi-footer` for npm/git install.
- User-facing command: `/pi-footer` or `/footer`.
- Keep Zentui-derived settings where possible but rename config file to avoid confusion if needed.

Preserve from Zentui:
- Editor chrome.
- Starship footer.
- Runtime detection.
- Git status indicators.
- Token/context/cost display.
- Existing extension status placement behavior.

Add ORGM integrations:
- Caveman display by listening for `PI_CAVEMAN_STATE_EVENT` and restoring `PI_CAVEMAN_STATE_KEY`.
- Title display only by listening for `TITLE_STATE_EVENT` and restoring `SESSION_TITLE_ENTRY_TYPE`.
- Optional extra line below Zentui footer: `title · caveman:full`.

Do not add to `pi-footer`:
- Title generation.
- Ask/todo/banner logic.
- pi-mem storage logic.
- Font management.

## `pi-harness` Revert Scope

Revert the experimental Zentui visual implementation from `pi-harness`:

- Remove `extensions/lib/starship.ts`.
- Remove `extensions/lib/zentui-editor.ts`.
- Remove Starship/editor integration from `extensions/minimal.ts`.
- Restore `minimal.ts` to its pre-Zentui behavior.
- Remove tests that only cover the experimental visual attempt.
- Keep unrelated useful changes only when they are explicitly not part of the visual attempt.

`pi-harness` should document that footer/editor UI lives in `pi-footer` going forward.

## README / Package Description Requirement

Each ORGM stack repo should include a section like this:

```md
## ORGM Pi stack

This package is part of the ORGM Pi extension stack.

Recommended install:

```bash
for pkg in pi-mem pi-caveman pi-harness pi-footer; do
  pi install git:github.com/osmargm1202/$pkg
done
```

Packages:

- `pi-mem`: local memory/context index provider.
- `pi-caveman`: caveman runtime and shared state events.
- `pi-harness`: ORGM commands, config, title, ask/todo/banner bridge.
- `pi-footer`: Zentui-based editor/footer UI that displays ORGM status.
```

Each package should also document:

```md
## Coupled integrations

Produces:
- event names
- session custom entries
- commands

Consumes:
- event names from other ORGM packages
- optional commands/statuses

Hard dependencies:
- none / package list

Soft dependencies:
- improves UI when installed with ...
```

## Acceptance Criteria

- `pi-harness` no longer owns Zentui-style footer/editor visuals.
- `pi-harness` README documents the ORGM Pi stack install command and coupled integrations.
- New `pi-footer` plan/spec is ready to create the fork repo.
- Existing `pi-harness` tests pass after revert.
