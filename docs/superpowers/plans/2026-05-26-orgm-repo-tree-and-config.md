# Orgm Repo Tree And Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace repo cache file generation with startup project tree context injection, centralize extension configuration in `orgm.json`, and rename pi-harness commands to `orgm-*` only.

**Architecture:** Add focused helpers for orgm config and repo tree generation. `extensions/repo-index.ts` becomes a session-start message injector similar to `awareness.ts`, with no `.pi-cache` writes. Existing extension config loaders read their slice from `~/.pi/agent/orgm.json`.

**Tech Stack:** TypeScript Pi extensions, Node fs/path/os APIs, existing assertion-based tests run with `bun <test-file>`.

---

## File Structure

- `extensions/lib/orgm-config.ts` — central config path, defaults, merging, blocked path helpers, new typed slices (`repoTree`, `caveman`, `minimalSkills`, `agentStatus`).
- `extensions/lib/repo-tree.ts` — pure tree root validation, ignore matching, directory traversal, and text formatting.
- `extensions/repo-index.ts` — repo-tree startup injection and `/orgm-repo-tree` command only.
- `extensions/lib/caveman-state.ts` — caveman config from `orgm.json` slice.
- `extensions/lib/agent-status-config.ts` — agent status config from `orgm.json` slice.
- `extensions/minimal.ts` — minimal skills config from `orgm.json` slice and `/orgm-minimal-*` command names.
- Command files — rename commands to `orgm-*` only: `caveman`, `title`, `repo-index`, `repo-init`, `minimal-footer`, `minimal-skills`, `sessions`, `agents`, `agent-status`, `todos`, `sdd-preflight`, `sdd-init`, `spec-dis`, `clear`, `agents-model`, `primary-agent`.
- Tests: add/update `tests/orgm-config.test.ts`, `tests/repo-tree.test.ts`, `tests/repo-index-extension.test.ts`, focused config/command tests where practical.

## Task 1: Central orgm config slices

**Files:**
- Modify: `extensions/lib/orgm-config.ts`
- Modify: `extensions/lib/caveman-state.ts`
- Modify: `extensions/lib/agent-status-config.ts`
- Modify: `extensions/minimal.ts`
- Create/modify tests: `tests/orgm-config.test.ts`

- [ ] Write failing tests proving config slices load from one `orgm.json`: `repoTree.maxDepth`, `caveman.defaultLevel`, `minimalSkills.enabled`, `agentStatus.showWidget`.
- [ ] Run `bun tests/orgm-config.test.ts`; expect failure because slices do not exist yet.
- [ ] Implement slice defaults and merge helpers in `orgm-config.ts`.
- [ ] Update caveman/agent-status/minimal config loaders to use orgm config slices.
- [ ] Run `bun tests/orgm-config.test.ts tests/caveman-state.test.ts tests/agent-status-widget.test.ts`; expect pass.

## Task 2: Project tree generator

**Files:**
- Create: `extensions/lib/repo-tree.ts`
- Create: `tests/repo-tree.test.ts`

- [ ] Write failing tests for safe root selection: accepts `/home/user/Code/project`, rejects `/home/user`, `/`, `/usr`, `/etc`, `/var`, and paths outside home project roots.
- [ ] Write failing tests for depth and ignores: default depth 3, ignored folders shown but not descended, `.env`/lock files hidden.
- [ ] Run `bun tests/repo-tree.test.ts`; expect failure because helper does not exist.
- [ ] Implement pure helpers: `isSafeProjectRoot`, `resolveTreeRoot`, `buildProjectTreeText`.
- [ ] Run `bun tests/repo-tree.test.ts`; expect pass.

## Task 3: Replace repo-index file generation with startup tree injection

**Files:**
- Rewrite: `extensions/repo-index.ts`
- Modify: `tests/repo-index-extension.test.ts`

- [ ] Write failing tests for `buildRepoTreeMessageContent()` and idempotent custom-message injection semantics; tests must prove no `.pi-cache` text is referenced.
- [ ] Run `bun tests/repo-index-extension.test.ts`; expect failure because old prompt/cache behavior remains.
- [ ] Rewrite extension to send a custom message on eligible `session_start`, render collapsed as `repo-tree`, and register only `/orgm-repo-tree`.
- [ ] Run `bun tests/repo-index-extension.test.ts tests/repo-tree.test.ts`; expect pass.

## Task 4: Rename commands to orgm-* only

**Files:**
- Modify command registrations across `extensions/*.ts` and `extensions/lib/orgm-flow.ts`.
- Create/modify tests: `tests/orgm-commands.test.ts` or focused static test.

- [ ] Write failing static test that scans extension files and asserts every `pi.registerCommand("...")` name starts with `orgm-`.
- [ ] Run `bun tests/orgm-commands.test.ts`; expect failure listing old names.
- [ ] Rename all command names to `orgm-*` with no old aliases.
- [ ] Update descriptions/usages that mention old slash commands.
- [ ] Run `bun tests/orgm-commands.test.ts`; expect pass.

## Task 5: Final verification

**Files:** all changed files.

- [ ] Run focused tests: `bun tests/orgm-config.test.ts tests/repo-tree.test.ts tests/repo-index-extension.test.ts tests/orgm-commands.test.ts tests/caveman-state.test.ts tests/agent-status-widget.test.ts tests/minimal-footer-utils.test.ts tests/title.test.ts`.
- [ ] Run packaging check: `npm pack --dry-run --json` and confirm new files are included.
- [ ] Report any unrelated test blocker separately.
