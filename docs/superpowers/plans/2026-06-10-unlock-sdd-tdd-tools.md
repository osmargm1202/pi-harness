# Unlock SDD/TDD Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let SDD and TDD run with full build-style tool access, including unrestricted inline `bash`, `write`, `edit`, and subagent execution, while keeping Plan Mode restricted.

**Architecture:** Keep mode gating centered in `extensions/mode.ts`. Change SDD/TDD to share Build-style active tool exposure and skip runtime write/bash blocks, while Plan/Ask remain gated. Update mode prompt docs to match real behavior and adjust regression tests so Plan remains restricted but SDD/TDD stay open.

**Tech Stack:** TypeScript, Bun tests, ORGM mode prompts in Markdown.

---

### Task 1: Open runtime gating for SDD/TDD only

**Files:**
- Modify: `extensions/mode.ts`
- Modify: `extensions/subagents.ts`
- Test: `tests/mode-extension.test.ts`
- Test: `tests/subagent-mode-scope.test.ts`

- [ ] **Step 1: Write failing test expectations**

Add/adjust assertions so SDD/TDD expect `write` and `edit` in active tools and no longer expect unsafe `bash` to be blocked, while Plan assertions still expect blocking.

- [ ] **Step 2: Run targeted test to verify it fails**

Run: `bun test tests/mode-extension.test.ts`
Expected: FAIL because current mode gating still blocks SDD/TDD inline tools.

- [ ] **Step 3: Write minimal implementation**

Update runtime gating so:
- `extensions/mode.ts` gives SDD/TDD Build-style tool exposure (`activeToolsForMode` returns all tools for `build`, `sdd`, `tdd`)
- `isWriteAllowedInMode()` returns `true` for `sdd` and `tdd`
- `tool_call` runtime blocking applies only to `plan` and `ask`
- `extensions/subagents.ts` stops restricting `deploy_agent` target scope for `sdd` and `tdd`

- [ ] **Step 4: Run targeted test to verify it passes**

Run: `bun test tests/mode-extension.test.ts`
Expected: PASS.

### Task 2: Align mode prompt docs with new runtime behavior

**Files:**
- Modify: `agents/sdd.md`
- Modify: `agents/tdd.md`
- Test: `tests/mode-subagent-prompts.test.ts`

- [ ] **Step 1: Write failing prompt expectations**

Update prompt tests so they stop requiring text that forbids inline mutating `bash`/`write`/`edit` in SDD/TDD, but still require orchestration guidance, subagent freedom, and fast-agent-on-explicit-request behavior.

- [ ] **Step 2: Run targeted test to verify it fails**

Run: `bun test tests/mode-subagent-prompts.test.ts`
Expected: FAIL because prompts still describe inline mutation bans.

- [ ] **Step 3: Write minimal prompt updates**

Revise `agents/sdd.md` and `agents/tdd.md` so they:
- keep orchestrator framing and strong delegation preference
- explicitly allow direct inline execution when useful
- keep remote/destructive examples (`git push`, `git reset`, installs, migrations, OS/network mutation) as discouraged/avoid unless clearly intended
- keep preferred SDD/TDD worker guidance, broad subagent freedom, and explicit fast-agent rule

- [ ] **Step 4: Run targeted test to verify it passes**

Run: `bun test tests/mode-subagent-prompts.test.ts`
Expected: PASS.

### Task 3: Run focused and full verification

**Files:**
- Test: `tests/mode-extension.test.ts`
- Test: `tests/mode-subagent-prompts.test.ts`

- [ ] **Step 1: Run focused regression suite**

Run: `bun test tests/mode-extension.test.ts tests/mode-subagent-prompts.test.ts`
Expected: PASS.

- [ ] **Step 2: Run full project test suite**

Run: `bun test`
Expected: PASS or current known clean suite output with zero failures.

- [ ] **Step 3: Review diff before branch finish**

Run: `git diff -- extensions/mode.ts extensions/subagents.ts agents/sdd.md agents/tdd.md tests/mode-extension.test.ts tests/mode-subagent-prompts.test.ts tests/subagent-mode-scope.test.ts`
Expected: Only planned files changed.
