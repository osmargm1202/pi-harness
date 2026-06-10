# Implementation Tasks: pi-caveman-package

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 900-1,500 changed lines across two repos |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1: `pi-caveman` package fork/runtime/tests/docs → PR 2: `pi-harness` observer cleanup/tests/docs → PR 3: install/no-install verification evidence if separated |
| Delivery strategy | exception-ok; user requested full SDD/apply/verify in isolated worktree and full fork, so apply may proceed with `size:exception` if chaining is impractical |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: size-exception
400-line budget risk: High

## Implementation Order

### 1. Fork/workspace setup boundary
- [x] Verify current isolated harness worktree remains `/home/osmarg/Code/pi-harness/.worktrees/pi-caveman-package` on branch `pi-caveman-package`.
- [x] Create or verify full fork workspace for `osmargm1202/pi-caveman` at `/home/osmarg/Code/pi-caveman`, forked from `JuliusBrussee/caveman` with upstream attribution retained.
- [x] Inspect `pi-caveman` upstream files and current `pi-harness/extensions/caveman.ts`, `pi-harness/extensions/lib/caveman-state.ts`, and `pi-harness/skills/caveman/SKILL.md` only to port behavior; do not import harness modules from new package.
- [x] Verification: `git -C /home/osmarg/Code/pi-caveman remote -v`, `git -C /home/osmarg/Code/pi-caveman status --short`, and harness `git status --short` show expected isolated workspaces.
- [x] Rollback: remove `/home/osmarg/Code/pi-caveman` workspace if fork setup is wrong; leave harness worktree untouched.

### 2. RED: `pi-caveman` package manifest and contracts
- [x] In `/home/osmarg/Code/pi-caveman`, add failing tests in `tests/contracts.test.ts` for `PI_CAVEMAN_STATE_KEY === "pi-caveman:state"`, `PI_CAVEMAN_STATE_EVENT === "pi-caveman:state"`, valid state shape, and invalid payload rejection.
- [x] Add failing manifest/package test or assertion covering `package.json` Pi metadata: `pi.extensions: ["./extensions/caveman.ts"]`, no `pi.skills`, `files` includes `extensions`, `src`, `README.md`, `LICENSE`.
- [x] Verification: `bun test tests/contracts.test.ts` fails for missing contract/manifest implementation.
- [x] Rollback: delete only new failing tests if contract direction changes.

### 3. GREEN: `pi-caveman` package skeleton/contracts
- [x] Create `/home/osmarg/Code/pi-caveman/package.json` as Pi-native package `pi-caveman` with peer deps and `bun test` script per design.
- [x] Create `/home/osmarg/Code/pi-caveman/src/contracts.ts` exporting `PI_CAVEMAN_STATE_KEY`, `PI_CAVEMAN_STATE_EVENT`, `PiCavemanStateV1`, caveman levels, and payload validator.
- [x] Create `/home/osmarg/Code/pi-caveman/extensions/caveman.ts` as empty extension entrypoint that can load without harness imports.
- [x] Verification: `bun test tests/contracts.test.ts` passes.
- [x] Rollback: revert `package.json`, `src/contracts.ts`, `extensions/caveman.ts` in `pi-caveman`.

### 4. RED: `pi-caveman` config/startup/prompt tests
- [x] Add failing tests in `/home/osmarg/Code/pi-caveman/tests/runtime.test.ts` for default config => enabled `full`, `autoEnable:false` => disabled/no overlay, `defaultLevel:"lite"` => enabled `lite`, and no `SKILL.md` prompt source.
- [x] Add failing tests for atomic config write behavior in `/home/osmarg/Code/pi-caveman/src/config.ts` via temp agent dir.
- [x] Verification: `bun test tests/runtime.test.ts` fails for missing runtime/config.
- [x] Rollback: delete new runtime tests if startup model changes.

### 5. GREEN: `pi-caveman` runtime/config/prompt
- [x] Implement `/home/osmarg/Code/pi-caveman/src/config.ts` with schema defaults `{schemaVersion:1, autoEnable:true, defaultLevel:"full", showStartupNotice:false}`, tolerant reads, and temp-file + rename writes under `${getAgentDir()}/pi-caveman/config.json`.
- [x] Implement `/home/osmarg/Code/pi-caveman/src/prompt-rules.ts` with typed caveman rules and `buildPromptOverlay()` source text that references `pi-caveman` package rules, not `skills/caveman/SKILL.md`.
- [x] Implement `/home/osmarg/Code/pi-caveman/src/runtime.ts` to derive session state, publish `pi-caveman:state` entry/event, and expose `before_agent_start` overlay only when enabled.
- [x] Wire `/home/osmarg/Code/pi-caveman/extensions/caveman.ts` to load config, initialize startup state on session start, listen for input activation/deactivation, and register before-agent prompt overlay.
- [x] Verification: `bun test tests/runtime.test.ts tests/contracts.test.ts` passes.
- [x] Rollback: revert `src/config.ts`, `src/prompt-rules.ts`, `src/runtime.ts`, and entrypoint changes.

### 6. RED: `pi-caveman` command/stat/compress tests
- [x] Add failing tests in `/home/osmarg/Code/pi-caveman/tests/commands.test.ts` for command registration: `/caveman`, `/caveman-commit`, `/caveman-review`, `/caveman-compress`, `/caveman-stats`.
- [x] Add failing command behavior tests: `/caveman`, `/caveman on`, `/caveman off|normal`, `/caveman lite|full|ultra|wenyan|wenyan-lite|wenyan-full|wenyan-ultra` update state/config/entry/event as specified.
- [x] Add failing tests in `/home/osmarg/Code/pi-caveman/tests/stats.test.ts` for best-effort stats read/write/reset labels as estimates.
- [x] Verification: `bun test tests/commands.test.ts tests/stats.test.ts` fails for missing commands/stats.
- [x] Rollback: delete new command/stat tests if command scope changes.

### 7. GREEN: `pi-caveman` commands/stats/helpers
- [x] Implement `/home/osmarg/Code/pi-caveman/src/commands.ts` with all five upstream-style commands and no harness dependencies.
- [x] Implement `/home/osmarg/Code/pi-caveman/src/commit.ts`, `src/review.ts`, and `src/compress.ts` with scoped behavior from design; require UI confirmation or safe no-op guidance for destructive file compression.
- [x] Implement `/home/osmarg/Code/pi-caveman/src/stats.ts` storing `${getAgentDir()}/pi-caveman/stats.json`, labeling token savings as estimates.
- [x] Wire command registration from `/home/osmarg/Code/pi-caveman/extensions/caveman.ts`.
- [x] Verification: `bun test` passes in `/home/osmarg/Code/pi-caveman`.
- [x] Rollback: revert `src/commands.ts`, `src/commit.ts`, `src/review.ts`, `src/compress.ts`, `src/stats.ts`, and entrypoint command wiring.

### 8. TRIANGULATE/REFACTOR: `pi-caveman` docs and install verification
- [x] Update `/home/osmarg/Code/pi-caveman/README.md` with install command `pi install git:github.com/osmargm1202/pi-caveman`, auto-on default, `/caveman off`, config path, commands, shared `pi-caveman:state` contract, and upstream attribution.
- [x] Ensure `/home/osmarg/Code/pi-caveman/LICENSE` exists and package file list includes no `skills/caveman/SKILL.md`.
- [x] Run package checks: `bun test`, `pi -e ./extensions/caveman.ts`, `pi install git:github.com/osmargm1202/pi-caveman`, `pi list` in disposable Pi config/temp home when possible.
- [x] Record any install limitations as verify evidence, not hidden assumptions.
- [x] Rollback: revert README/package metadata changes if install target changes.

### 9. RED: `pi-harness` extraction/no-install tests
- [x] In `/home/osmarg/Code/pi-harness/.worktrees/pi-caveman-package`, update tests to fail until runtime is removed: `tests/minimal-footer-utils.test.ts`, `tests/agent-status-widget.test.ts`, `tests/package-paths.test.ts`.
- [x] Delete or replace `tests/caveman-state.test.ts` with package-inspection/no-install assertions proving `extensions/caveman.ts` and `skills/caveman/SKILL.md` are absent.
- [x] Add source assertions that harness no longer references `loadCavemanConfig`, `resolveInitialCavemanState`, old `caveman-level`, old `caveman:state-changed`, `showCaveman`, `CAVEMAN_STATE_EVENT`, or `formatCavemanStatus` outside observer-only code.
- [x] Verification: focused harness tests fail before cleanup: `bun test tests/minimal-footer-utils.test.ts tests/agent-status-widget.test.ts tests/package-paths.test.ts`.
- [x] Rollback: restore previous tests if extraction is deferred.

### 10. GREEN: remove harness-owned caveman runtime
- [x] Delete `/home/osmarg/Code/pi-harness/.worktrees/pi-caveman-package/extensions/caveman.ts`.
- [x] Delete `/home/osmarg/Code/pi-harness/.worktrees/pi-caveman-package/skills/caveman/SKILL.md`.
- [x] Delete or replace `/home/osmarg/Code/pi-harness/.worktrees/pi-caveman-package/tests/caveman-state.test.ts` with no-install/package absence coverage.
- [x] Refactor `/home/osmarg/Code/pi-harness/.worktrees/pi-caveman-package/extensions/lib/caveman-state.ts` to observer-only constants/types/validator/formatter, or delete if inlined into `extensions/minimal.ts`.
- [x] Verification: `test ! -e extensions/caveman.ts` and `test ! -e skills/caveman/SKILL.md` pass.
- [x] Rollback: restore deleted files from pre-change commit if harness must own runtime again.

### 11. GREEN: harness minimal optional observer
- [x] Update `/home/osmarg/Code/pi-harness/.worktrees/pi-caveman-package/extensions/minimal.ts` to read last session entry with `customType === "pi-caveman:state"`, validate payload, listen to event `pi-caveman:state`, and render `caveman:<level>` or `caveman:off` only when valid observed state exists.
- [x] Ensure `minimal.ts` does not append caveman entries, emit caveman events, load caveman config, call caveman commands, or inject prompt rules.
- [x] Update `/home/osmarg/Code/pi-harness/.worktrees/pi-caveman-package/tests/minimal-footer-utils.test.ts` to cover no observed state => no `caveman:` substring and valid enabled state => `caveman:full`.
- [x] Verification: `bun test tests/minimal-footer-utils.test.ts` passes.
- [x] Rollback: revert `minimal.ts` and minimal tests if passive observer is removed.

### 12. GREEN: remove harness agent-status caveman coupling
- [x] Update `/home/osmarg/Code/pi-harness/.worktrees/pi-caveman-package/extensions/agent-status.ts` to remove caveman imports, state, event listener, startup restore, widget parameter, render line, and settings menu row.
- [x] Update `/home/osmarg/Code/pi-harness/.worktrees/pi-caveman-package/extensions/lib/agent-status-config.ts` to remove `showCaveman` from defaults/schema while ignoring stale saved keys on load.
- [x] Update `/home/osmarg/Code/pi-harness/.worktrees/pi-caveman-package/tests/agent-status-widget.test.ts` for no caveman output/config/imports.
- [x] Verification: `bun test tests/agent-status-widget.test.ts` passes.
- [x] Rollback: revert agent-status/config/test changes if widget ownership changes.

### 13. GREEN: harness package/docs cleanup
- [x] Update `/home/osmarg/Code/pi-harness/.worktrees/pi-caveman-package/package.json` only if package metadata explicitly exposes removed caveman files; keep `pi.skills: ["./skills"]` if other skills remain.
- [x] Update `/home/osmarg/Code/pi-harness/.worktrees/pi-caveman-package/README.md` line describing `extensions/` so harness does not claim bundled caveman runtime; mention optional minimal footer observation when `pi-caveman` is installed.
- [x] Update `/home/osmarg/Code/pi-harness/.worktrees/pi-caveman-package/tests/package-paths.test.ts` to remove bundled `skills/caveman/SKILL.md` preference assertions and prove package-path helpers are not used for caveman runtime.
- [x] Verification: `bun test tests/package-paths.test.ts` passes.
- [x] Rollback: revert README/package/test updates if packaging assumptions change.

### 14. REFACTOR: cross-repo contract alignment
- [x] Compare `/home/osmarg/Code/pi-caveman/src/contracts.ts` and harness observer code in `extensions/lib/caveman-state.ts` or `extensions/minimal.ts` for exact shared key/event `pi-caveman:state` and schema-version validation.
- [x] Search both repos for stale runtime terms: `skills/caveman/SKILL.md`, `extensions/caveman.ts` in harness package metadata, `caveman:state-changed`, `caveman-level`, `showCaveman`, `orgm-caveman` active controls.
- [x] Keep duplication limited to observer constants/types in harness; no imports between repos.
- [x] Verification: grep/search output contains only allowed docs/spec/tests references.
- [x] Rollback: revert only refactor edits that are not required for tests.

### 15. Full verification: `pi-caveman`
- [x] Run in `/home/osmarg/Code/pi-caveman`: `bun test`.
- [x] Run Pi extension smoke: `pi -e ./extensions/caveman.ts` if available in environment.
- [x] Run Git install verification in disposable Pi config/temp home: `pi install git:github.com/osmargm1202/pi-caveman`; then `pi list` and a new session check for default `full` startup, commands, and `pi-caveman:state` entry/event.
- [x] Save verification notes with commands, output summary, and any skipped environment-dependent checks.
- [ ] Rollback: if install verification fails due package shape, return to tasks 2-8; if network/auth fails, document as external blocker.

### 16. Full verification: `pi-harness` no-install and observer behavior
- [x] Run in harness worktree: `bun test`.
- [x] Run focused harness command: `bun test tests/minimal-footer-utils.test.ts tests/agent-status-widget.test.ts tests/package-paths.test.ts`.
- [x] Run package absence checks: `node -e "const p=require('./package.json'); console.log(JSON.stringify(p.pi))"`, `test ! -e extensions/caveman.ts`, `test ! -e skills/caveman/SKILL.md`.
- [x] Verify no-install behavior by checking harness does not register `/caveman`, does not inject caveman prompt rules, does not create/emit `pi-caveman:state`, and minimal footer renders no caveman UI without observed state.
- [x] Verify observer behavior with simulated or installed `pi-caveman:state` payload: minimal footer can display `caveman:full`, ignores invalid payloads, and never persists or mutates caveman state.
- [x] Rollback: if no-install behavior regresses, revert harness runtime cleanup; if observer-only behavior fails, return to tasks 11-14.

### 17. Review packaging and delivery decision record
- [x] Produce final changed-line counts for both repos with `git diff --stat` and compare to 400-line budget.
- [x] If split is practical, prepare separate review units: `pi-caveman` package PR first, harness cleanup PR second, verification evidence third or attached to both.
- [x] If single apply path is necessary, mark review as `size:exception` and include rationale: cross-repo extraction requires package and harness cleanup to verify install/no-install together.
- [x] Ensure final task/verify evidence maps back to both specs: `pi-caveman-runtime` and `pi-harness-caveman-observer`.
- [x] Rollback: package-by-package rollback; disable/remove `pi-caveman` first, then restore harness runtime only if needed.
