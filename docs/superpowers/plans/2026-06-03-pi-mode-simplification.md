# Pi Mode Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace primary-agent/teams/SDD bootstrap complexity with a small mode system and asset-scoped deployable subagents.

**Architecture:** `agents/` becomes mode prompt storage (`plan/build/ask/sdd/tdd`). `assets/subagents/` becomes the only packaged deployable subagent catalog. `extensions/mode.ts` owns mode state, prompt injection, keyboard cycling, status, and tool gating. `extensions/subagents.ts` keeps `deploy_agent` and drops `query_team`.

**Tech Stack:** Pi TypeScript extensions, Bun tests, markdown prompt assets.

---

## File Map

- Create `extensions/mode.ts` — mode controller, prompt injection, status, shortcut, tool gates.
- Modify `extensions/lib/orgm-config.ts` — replace primary/repo/flow config with mode config.
- Modify `extensions/lib/orgm-extension-config.ts` — remove legacy extension names, add `mode`.
- Modify `extensions/lib/orgm-extensions.ts` if needed — active extension count stays compatible.
- Modify `extensions/lib/agent-discovery.ts` — discover deployable agents from `assets/subagents` and local asset dirs only; remove primary discovery.
- Modify `extensions/subagents.ts` — keep `deploy_agent`, remove `query_team`/teams discovery.
- Modify `extensions/orgm.ts` — remove repo-index auto-enable and SDD compatibility status.
- Modify `extensions/minimal.ts` — stop listening for primary-agent state.
- Create `agents/plan.md`, `agents/build.md`, `agents/ask.md`, `agents/sdd.md`, `agents/tdd.md` — mode prompts.
- Create `assets/subagents/*.md` — moved SDD/TDD workers.
- Delete legacy active agents and legacy extensions listed by user.
- Update tests and README.

## Tasks

### Task 1: RED tests for new mode config/discovery

- [ ] Add tests covering default mode config, mode save/load, extension gating names, package paths without `teams.yaml`, and deployable discovery from `assets/subagents`.
- [ ] Run focused tests and confirm failures because mode config/discovery do not exist yet.

### Task 2: Implement mode config and asset subagent discovery

- [ ] Add `OrgmModeConfig` with default `plan` and allowed modes.
- [ ] Remove `defaultPrimaryAgent`, `flows`, `primaryAuto`, and `repoTree` from normalized defaults and writable slices.
- [ ] Change package paths to expose `assets/subagents`.
- [ ] Change deployable agent discovery to load only asset subagent dirs.
- [ ] Run focused tests and confirm green.

### Task 3: RED tests for `mode.ts`

- [ ] Add tests for mode default, explicit command changes, `alt+1` cycle, prompt injection, and tool blocking.
- [ ] Run focused tests and confirm failures because `extensions/mode.ts` does not exist.

### Task 4: Implement `extensions/mode.ts`

- [ ] Create mode extension with `/mode`, `alt+1`, session persistence, status colors, prompt injection from `agents/<mode>.md`, and tool gates.
- [ ] Plan/ask block write/edit and unsafe bash; build/sdd/tdd allow implementation tools.
- [ ] Run focused tests and confirm green.

### Task 5: Move prompts/subagents and delete legacy files

- [ ] Move SDD/TDD worker markdown from `agents/sdd-orchestrator/` to `assets/subagents/`.
- [ ] Create mode prompt markdown files in `agents/`.
- [ ] Delete VoltAgent folders, `pi-orchestrator`, `sdd-orchestrator`, `teams.yaml`, and manifest.
- [ ] Delete legacy extensions and lib files requested by user.

### Task 6: Remove teams/query_team and old primary plumbing

- [ ] Remove teams YAML parser, `discoverTeams`, `query_team` schema/tool/rendering from `extensions/subagents.ts`.
- [ ] Remove primary state imports/listeners from `extensions/minimal.ts`.
- [ ] Remove SDD compatibility command from `extensions/orgm.ts`/`orgm-flow.ts`; delete `orgm-flow.ts` if unreferenced.
- [ ] Update scripts/tests that asserted `query_team` or teams.

### Task 7: Update docs and full verification

- [ ] Update README to describe mode prompts and asset subagents.
- [ ] Run repo grep proving removed files/references are gone.
- [ ] Run focused Bun tests for modified behavior.
- [ ] Run full Bun test suite with local peer symlinks.
