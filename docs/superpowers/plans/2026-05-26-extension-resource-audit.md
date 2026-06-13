# Extension Resource Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Historical audit of package-bundled resources. Note: private skill packages must not be referenced or bundled by `pi-harness`.

**Architecture:** Add a shared package/resource path helper used by extension code instead of hardcoded `~/.pi/agent` assumptions. Cover primary-agent, agents-model, subagents, and caveman with focused Bun tests; keep project/user override precedence.

**Tech Stack:** TypeScript Pi extensions, Bun tests, Node filesystem fixtures.

---

### Task 1: Centralize package path helpers

**Files:**
- Create: `extensions/lib/package-paths.ts`
- Modify: `extensions/lib/agent-discovery.ts`
- Test: `tests/package-paths.test.ts`

- [ ] Write failing tests for current package root, agents dir, and installed caveman skill discovery.
- [ ] Run `bun tests/package-paths.test.ts` and verify failure.
- [ ] Implement helper functions.
- [ ] Update agent discovery to use helper.
- [ ] Run package path and agent discovery tests.

### Task 2: Verify primary-agent and agents-model package discovery

**Files:**
- Modify: `extensions/agent-selector.ts`
- Test: `tests/orgm-flow.test.ts`
- Test: `tests/agent-selector-models.test.ts`

- [ ] Write tests proving configured primary resolves package `pi-orchestrator`.
- [ ] Write tests proving model selector model collection includes models from package-bundled agents.
- [ ] Export minimal pure helper needed for testing.
- [ ] Run tests and verify pass.

### Task 3: Fix caveman skill path discovery

**Files:**
- Modify: `extensions/lib/caveman-state.ts`
- Test: `tests/caveman-state.test.ts`

- [ ] Historical/obsolete: do not resolve or bundle private skill packages; keep private skills outside `pi-harness`.
- [ ] Implement fallback search through package-installed skill directories.
- [ ] Run caveman test and existing caveman/minimal tests.

### Task 4: Final audit verification

**Files:**
- Modify only if tests reveal issues.

- [ ] Run all `tests/*.test.ts`.
- [ ] Run installed-checkout smoke after `pi update` in a later integration step.
