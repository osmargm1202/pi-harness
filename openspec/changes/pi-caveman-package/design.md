# Design: pi-caveman-package

## Goal

Move caveman runtime ownership from current `pi-harness` package to forked `osmargm1202/pi-caveman`, while keeping `pi-harness` only as optional passive footer observer.

## Key decisions

- `pi-caveman` owns commands, prompt injection, startup auto-enable, persistent config, stats, session entry, and events.
- `pi-harness` owns no caveman runtime code after cleanup. It may keep only tiny observer constants/types if needed by `extensions/minimal.ts`.
- Shared observable contract uses one stable key/name: `pi-caveman:state` for both session entry `customType` and event name.
- Prompt rules live in `pi-caveman` TypeScript/data files, not `skills/caveman/SKILL.md`.
- Absence of `pi-caveman` must be silent in `pi-harness`: no footer placeholder, no command, no state entry, no event.

## Repository 1: `pi-caveman` package design

### Package shape

Fork `JuliusBrussee/caveman` to `osmargm1202/pi-caveman`; preserve upstream README attribution and command names, but make Pi package root directly installable.

Planned files:

```text
package.json
README.md
LICENSE
extensions/caveman.ts
src/config.ts
src/contracts.ts
src/prompt-rules.ts
src/runtime.ts
src/commands.ts
src/stats.ts
src/compress.ts
src/commit.ts
src/review.ts
tests/runtime.test.ts
tests/commands.test.ts
tests/contracts.test.ts
tests/stats.test.ts
```

### `package.json` Pi manifest

Use Pi package manifest, no `skills` exposure:

```json
{
  "name": "pi-caveman",
  "version": "0.1.0",
  "private": false,
  "description": "Pi-native caveman runtime package.",
  "keywords": ["pi-package", "pi", "extension", "caveman"],
  "license": "MIT",
  "files": ["extensions", "src", "README.md", "LICENSE"],
  "pi": {
    "extensions": ["./extensions/caveman.ts"]
  },
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": "*",
    "@earendil-works/pi-tui": "*"
  },
  "peerDependenciesMeta": {
    "@earendil-works/pi-coding-agent": { "optional": true },
    "@earendil-works/pi-tui": { "optional": true }
  },
  "scripts": {
    "test": "bun test"
  }
}
```

Install target remains:

```bash
pi install git:github.com/osmargm1202/pi-caveman
```

### Extension entrypoint

`extensions/caveman.ts`:

- Default export `(pi: ExtensionAPI) => void`.
- On load, registers all commands.
- On `session_start`, loads config, initializes state, appends `pi-caveman:state`, emits `pi-caveman:state`.
- On `input`, handles natural language activation/deactivation.
- On `before_agent_start`, injects prompt overlay only when state enabled.

No dependency on `pi-harness` modules.

### Config and storage

Persistent config file:

```text
${getAgentDir()}/pi-caveman/config.json
```

Config schema:

```ts
type CavemanLevel = "lite" | "full" | "ultra" | "wenyan-lite" | "wenyan-full" | "wenyan-ultra";

interface CavemanConfig {
  schemaVersion: 1;
  autoEnable: boolean;      // default true
  defaultLevel: CavemanLevel; // default "full"
  showStartupNotice: boolean; // default false
}
```

State is session-local, derived from config at startup. Command changes persist config when they express durable preference:

- `/caveman off|stop|normal` => current session disabled, `autoEnable=false`.
- `/caveman on` => enabled with `defaultLevel`, `autoEnable=true`.
- `/caveman <level>` => enabled, `defaultLevel=<level>`, `autoEnable=true`.

Writes use atomic temp-file + rename. Invalid/missing config falls back to defaults and writes normalized config only after user command, not during read.

### Prompt rules source

`src/prompt-rules.ts` exports rules as typed constants:

```ts
export const CAVEMAN_LEVELS = ["lite", "full", "ultra", "wenyan-lite", "wenyan-full", "wenyan-ultra"] as const;
export const CAVEMAN_RULES = {
  shared: "...",
  persistence: "...",
  autoClarity: "...",
  boundaries: "...",
  levels: { full: "...", lite: "..." }
};
```

`buildPromptOverlay(state)` constructs same runtime block current harness injects, but `Behavior source:` becomes `pi-caveman/src/prompt-rules.ts` or `pi-caveman package rules`, not SKILL path.

### Shared state entry/event contract

`src/contracts.ts`:

```ts
export const PI_CAVEMAN_STATE_KEY = "pi-caveman:state";
export const PI_CAVEMAN_STATE_EVENT = "pi-caveman:state";

export interface PiCavemanStateV1 {
  schemaVersion: 1;
  packageName: "pi-caveman";
  enabled: boolean;
  level: CavemanLevel | null;
  defaultLevel: CavemanLevel;
  autoEnable: boolean;
  source: "startup" | "command" | "input" | "config";
  updatedAt: number;
}
```

Publication rules:

```ts
pi.appendEntry(PI_CAVEMAN_STATE_KEY, state);
pi.events.emit(PI_CAVEMAN_STATE_EVENT, state);
```

Consumers must validate `schemaVersion === 1`, `packageName === "pi-caveman"`, boolean `enabled`, and known level/null.

### Commands

Register upstream-style commands:

- `/caveman [status|on|off|normal|lite|full|ultra|wenyan|wenyan-lite|wenyan-full|wenyan-ultra]`
  - No args: notify current state and usage.
  - `wenyan` aliases `wenyan-full`.
- `/caveman-commit [optional context]`
  - Returns conventional commit guidance in caveman style. Does not mutate state.
- `/caveman-review [optional context]`
  - Returns terse review guidance/comment format. Does not mutate state.
- `/caveman-compress <file>`
  - Reads/writes target after UI confirmation unless explicit safe flag exists later. Preserves code fences, URLs, paths, frontmatter. Out-of-scope for harness.
- `/caveman-stats [--reset]`
  - Shows session/lifetime estimates and current config. `--reset` clears stats after confirmation.

### Stats strategy

`src/stats.ts` owns best-effort stats, never blocks runtime:

- Store file: `${getAgentDir()}/pi-caveman/stats.json`.
- Track command count, enabled sessions, disabled sessions, level switches, compress file savings, estimated output tokens saved.
- For token savings, prefer available usage events if Pi exposes token usage; otherwise estimate from assistant output visible to extension by comparing normal word-count heuristic to caveman word-count heuristic.
- `/caveman-stats` labels estimates clearly; no false precision.

### Tests and verification for `pi-caveman`

Unit tests:

- Contract constants equal `pi-caveman:state`.
- Default config produces `enabled=true`, `level="full"` on startup.
- Config `autoEnable=false` produces disabled state and no prompt overlay.
- `/caveman <level>` updates state, config, entry, and event.
- Prompt overlay contains rules and no `SKILL.md` reference.
- Commands are registered by name.

Manual/package verification:

```bash
bun test
pi -e ./extensions/caveman.ts
pi install git:github.com/osmargm1202/pi-caveman
pi list
```

Evidence required: install succeeds, new session starts `full`, commands route, entry/event emitted.

## Repository 2: current `pi-harness` cleanup design

### File-level changes

Remove runtime sources:

```text
DELETE extensions/caveman.ts
DELETE skills/caveman/SKILL.md
DELETE tests/caveman-state.test.ts
```

Refactor or remove helper:

```text
extensions/lib/caveman-state.ts
```

Preferred: replace with observer-only constants/types/validators used only by `minimal.ts`, or delete if constants are inlined in `minimal.ts`.

Observer-only helper may contain only:

```ts
export const PI_CAVEMAN_STATE_KEY = "pi-caveman:state";
export const PI_CAVEMAN_STATE_EVENT = "pi-caveman:state";
export type ObservedCavemanLevel = ...;
export function normalizeObservedCavemanState(value: unknown): ObservedCavemanState | null;
export function formatObservedCavemanStatus(state: ObservedCavemanState): string;
```

It must not import filesystem, `orgm-config`, `package-paths`, or parse prompt rules.

Update:

```text
extensions/minimal.ts
extensions/agent-status.ts
extensions/lib/agent-status-config.ts
package.json
README.md
tests/minimal-footer-utils.test.ts
tests/agent-status-widget.test.ts
tests/package-paths.test.ts
```

### `extensions/minimal.ts` optional observer algorithm

State:

```ts
let observedCaveman: ObservedCavemanState | null = null;
```

Startup:

1. Read `ctx.sessionManager.getEntries()`.
2. Find last custom entry with `customType === "pi-caveman:state"`.
3. Validate payload with observer validator.
4. If valid, set `observedCaveman`; else leave `null`.
5. Do not append entry, emit event, load config, or call commands.

Event:

1. Listen to `pi.events.on("pi-caveman:state", payload => ...)`.
2. Validate payload.
3. If valid, update `observedCaveman` and request render.
4. If invalid, ignore silently.

Render:

- If `observedCaveman === null`, render no caveman text.
- If `enabled`, render `caveman:<level>` in accent.
- If disabled and valid state exists, render `caveman:off` in text color.
- Never read any `showStatus` config from harness.

### `extensions/agent-status.ts`

Remove all caveman coupling:

- Delete imports from caveman helper.
- Delete `CavemanLevel`, `currentCaveman`, event listener, startup state restore.
- Remove `caveman` from widget state signature.
- Remove `cavemanLevel` parameter from `buildWidgetLines`.
- Remove `config.showCaveman` rendering and settings menu row.

`extensions/lib/agent-status-config.ts` removes `showCaveman` from defaults/schema. Migration: ignore stale saved `showCaveman` key when loading; no write needed.

### `package.json` and docs

`package.json` already exposes whole `skills` directory. After deleting `skills/caveman/SKILL.md`, keep `pi.skills: ["./skills"]` if other skills remain. Ensure `files` no longer includes deleted caveman runtime by absence, not by ignore trick.

README contents line changes from “including ... caveman” to mention optional footer observation if installed beside `pi-caveman`.

### Harness tests and verification

Add/update tests:

- `tests/minimal-footer-utils.test.ts`: source assertions prove no `loadCavemanConfig`, no `resolveInitialCavemanState`, no old `caveman-level`, no old `caveman:state-changed`; does include `pi-caveman:state` observer.
- Minimal render test with no observed state shows no `caveman:` substring.
- Minimal render/format helper test with valid observed enabled state shows `caveman:full`.
- `tests/agent-status-widget.test.ts`: source/config assertions prove no `showCaveman`, no `CAVEMAN_STATE_EVENT`, no `formatCavemanStatus`.
- `tests/package-paths.test.ts`: remove assertion that bundled `skills/caveman/SKILL.md` exists; replace with assertion package path helper is not used for caveman.
- Package inspection test or script verifies `extensions/caveman.ts` and `skills/caveman/SKILL.md` absent.

Commands:

```bash
bun test
bun test tests/minimal-footer-utils.test.ts tests/agent-status-widget.test.ts tests/package-paths.test.ts
node -e "const p=require('./package.json'); console.log(JSON.stringify(p.pi))"
test ! -e extensions/caveman.ts
test ! -e skills/caveman/SKILL.md
```

## Migration plan

1. Build `pi-caveman` fork package with runtime behavior and tests.
2. Verify `pi install git:github.com/osmargm1202/pi-caveman` in disposable Pi config or temp home.
3. Remove harness runtime files and update observer-only minimal footer.
4. Remove agent-status caveman UI/config.
5. Update docs/tests.
6. Run verification for both repos.

Existing user config under `orgmConfig.caveman` remains ignored by `pi-harness`. Optional migration can be documented for users:

```json
{
  "autoEnable": false,
  "defaultLevel": "full"
}
```

No automatic migration across packages in first release; avoids harness writing `pi-caveman` config.

## Rollback

- If `pi-caveman` install/runtime fails: `pi remove git:github.com/osmargm1202/pi-caveman` or remove package entry from Pi settings.
- If harness cleanup causes regressions: restore deleted files from previous harness commit and restore old imports/tests.
- Rollback order: disable/remove `pi-caveman` first, then restore harness runtime only if users still need bundled caveman behavior.

## Risks / tradeoffs

- Auto-on default can surprise users; `/caveman off` must clearly persist `autoEnable=false`.
- Stats are best-effort unless Pi exposes exact token usage events; label as estimates.
- Removing `SKILL.md` breaks manual skill-loading workflows by design; README must point to `pi install` path.
- Shared contract stability is critical. Keep `pi-caveman:state` constants duplicated only through tiny observer helper or tests.
