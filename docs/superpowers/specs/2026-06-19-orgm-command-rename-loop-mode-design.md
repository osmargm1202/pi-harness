# ORGM Command Rename and Loop Prompt Mode Design Spec

**Date:** 2026-06-19  
**Status:** Approved

## Overview

Current bundled command surface is inconsistent with the requested UX:

- bundled commands still use the `orgm-*` prefix
- `pi-loop` still registers `orgm-loop`
- `pi-loop` only supports iteration-driven continuation mode
- command autocomplete coverage across bundled ORGM command packages is incomplete

Goal: rename bundled `orgm-*` commands to short names, remove old names, add/finish argument completion for bundled ORGM commands, and extend `pi-loop` so `loop` supports Claude-Code-like timed/count prompt mode.

## User-Approved Scope

### Command rename
Rename all bundled ORGM commands and remove legacy names entirely:

- `orgm-clear` → `clear`
- `orgm-config-init` → `config-init`
- `orgm-footer` → `footer`
- `orgm-init` → `init`
- `orgm-limits` → `limits`
- `orgm-loop` → `loop`
- `orgm-rename` → `rename`
- `orgm-resume` → `resume`

Old `orgm-*` names must stop working.

### Autocomplete
Add or complete command autocomplete for all bundled ORGM command owners above.
Autocomplete should cover command options and obvious argument shapes where appropriate.

### Loop command behavior
Support both existing iterative mode and new direct prompt mode.

#### Direct prompt mode
Examples:

- `/loop 2m necesito lograr resolver este bug hasta que funcione`
- `/loop 20 fix this failing test and stop only when complete`

Semantics:

- First token after `loop` may be a duration (`2m`, `30s`, `1h`) or a count (`20`)
- Remaining text is the tracked task prompt
- Duration form means: re-check every given interval until completion or stop
- Count form means: continue checking up to the given count limit
- Re-check path should drive the agent toward a final `LOOP:DONE` response

#### Lifecycle commands
Keep explicit lifecycle/status commands too:

- `loop on`
- `loop off`
- `loop status`

## Repos Touched

| Repo | Change |
|------|--------|
| `pi-loop` | Rename command to `loop`; add direct prompt parser; add duration/count mode; add completions; remove old name |
| `pi-clear` | Rename command to `clear`; add/finish completions |
| `pi-init` | Rename commands to `init` and `config-init`; add/finish completions |
| `pi-limit` | Rename command to `limits`; add/finish completions |
| `pi-rename` | Rename command to `rename`; add/finish completions |
| `pi-resume` | Rename command to `resume`; add/finish completions |
| `pi-footer` | Rename command to `footer`; add/finish completions only if needed; no loop badge redesign expected |
| `pi-harness` | Refresh lockfile/dependency snapshots to pull updated owner packages |

## Architecture

### Ownership
Each command remains owned by its focused package. `pi-harness` must not become a central command router.

### Command completion model
Autocomplete stays package-local via each command's `getArgumentCompletions` handler. There is no central harness-owned autocomplete layer.

### Loop modes
`pi-loop` should support two operational families:

1. **Manual loop state mode**
   - `loop on|off|status`
   - retains session-scoped loop activation concept

2. **Prompt-driven loop mode**
   - `loop <duration> <prompt>`
   - `loop <count> <prompt>`
   - parses first token to determine mode
   - stores active loop task prompt and scheduling mode in extension state
   - on each loop cycle, sends or queues the continuation prompt until completion criteria are met

### Completion criterion
`[LOOP:DONE]` remains the stop signal. Timed/count mode should reuse the same stop detection path rather than inventing a second completion mechanism.

## Loop Parsing Rules

### Duration token
Accepted compact forms:

- `Ns`
- `Nm`
- `Nh`

Examples:

- `30s`
- `2m`
- `1h`

### Count token
A positive integer means max follow-up checks.

Example:

- `20`

### Prompt requirement
If using duration/count form, remaining text after the first token is required. Missing prompt should produce a user-facing help/error notification.

## Loop Execution Semantics

### Duration mode
When user runs `/loop 2m <prompt>`:

1. activate loop state
2. store interval = 2 minutes
3. store tracked prompt text
4. start/queue the first turn for that prompt
5. after each non-done completion, wait until next interval before re-checking
6. stop when assistant emits `[LOOP:DONE]` or when user runs `loop off`

### Count mode
When user runs `/loop 20 <prompt>`:

1. activate loop state
2. store max checks = 20
3. store tracked prompt text
4. start/queue first turn for that prompt
5. after each non-done completion, continue follow-up until limit reached
6. stop with warning when limit reached

### Existing iteration logic
Current iteration-based internal state may be reused for count mode, but timed mode requires scheduling support rather than immediate next-turn reinjection only.

## Autocomplete Requirements

### Loop
Suggested completion groups:

- lifecycle verbs: `on`, `off`, `status`
- usage hints: `2m <prompt>`, `20 <prompt>`
- optional duration examples: `30s`, `5m`, `1h`

### Other renamed commands
Each renamed command should provide completions for its current supported options/arguments where the command already has a constrained surface. If a command has no meaningful arguments, completion may be omitted only when there is nothing valid to suggest.

## Compatibility Rules

- old `orgm-*` command names must not remain registered
- help strings, notifications, tests, and docs must prefer new short names only
- `pi-footer` loop badge remains event-driven and should not depend on unsupported APIs

## pi-harness Rules

- update lockfile snapshots after owner package changes
- do not add local runtime command aliasing in harness
- preserve unrelated local modifications in tracked files while refreshing locks

## Testing Expectations

### Owner packages
Each touched owner package should gain or update focused tests for:

- new command name registration
- removal of old name
- autocomplete behavior where practical
- loop duration/count parsing and stop behavior in `pi-loop`

### Harness
Verify bundle install/load resolves updated package snapshots and no removed command names remain in installed owner package sources.

## Out of Scope

- central command router in `pi-harness`
- redesign of footer loop badge visuals
- changing the `[LOOP:DONE]` sentinel format
- aliasing old `orgm-*` commands for backward compatibility

## Success Criteria

- all bundled ORGM commands use short names only
- legacy `orgm-*` names are removed
- bundled ORGM command autocomplete is meaningfully implemented
- `loop` supports `on|off|status`, duration prompt mode, and count prompt mode
- `pi-harness` resolves updated owner package revisions after refresh
