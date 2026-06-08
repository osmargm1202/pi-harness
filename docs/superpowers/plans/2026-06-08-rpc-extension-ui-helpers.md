# RPC Extension UI Helpers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add typed helpers for Pi RPC extension UI requests/responses and record that RPC launch remains future/non-default.

**Architecture:** Create a focused `extensions/lib/rpc-extension-ui.ts` module that imports Pi's public `RpcExtensionUIRequest` and `RpcExtensionUIResponse` types, classifies dialog vs fire-and-forget requests, validates response shapes, and maps current subagent interaction payloads into official RPC UI request shapes. Keep current temp-file subagent bridge untouched.

**Tech Stack:** TypeScript ESM, Node test runner, Pi public SDK exports from `@earendil-works/pi-coding-agent`.

---

### Task 1: Add typed RPC extension UI helper module

**Files:**
- Create: `extensions/lib/rpc-extension-ui.ts`
- Test: `tests/rpc-extension-ui.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/rpc-extension-ui.test.ts` with tests importing `isRpcExtensionUIRequest`, `isRpcDialogRequest`, `isRpcFireAndForgetRequest`, `isRpcExtensionUIResponse`, `mapPermissionPayloadToRpcSelectRequest`, and `mapQuestionPayloadToRpcRequest` from `../extensions/lib/rpc-extension-ui.ts`.

- [ ] **Step 2: Run RED**

Run: `node --test tests/rpc-extension-ui.test.ts`
Expected: FAIL because module/export does not exist.

- [ ] **Step 3: Implement minimal helper module**

Create `extensions/lib/rpc-extension-ui.ts` importing `type RpcExtensionUIRequest` and `type RpcExtensionUIResponse` from `@earendil-works/pi-coding-agent`. Export:
- `RPC_DIALOG_METHODS`
- `RPC_FIRE_AND_FORGET_METHODS`
- `isRpcExtensionUIRequest(value)`
- `isRpcDialogRequest(value)`
- `isRpcFireAndForgetRequest(value)`
- `isRpcExtensionUIResponse(value)`
- `mapPermissionPayloadToRpcSelectRequest(id, payload)`
- `mapQuestionPayloadToRpcRequest(id, payload)`

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/rpc-extension-ui.test.ts`
Expected: PASS.

### Task 2: Mark RPC backend as future/non-default in deploy_agent source

**Files:**
- Modify: `extensions/subagents.ts`
- Test: `tests/subagents-assets-discovery.test.ts`

- [ ] **Step 1: Write failing source guard test**

Add assertions that `deploy_agent` references `rpc-extension-ui` helpers in comments/import-free planning text and still restricts `launchBackend` to `embedded`.

- [ ] **Step 2: Run RED**

Run: `node --test tests/subagents-assets-discovery.test.ts`
Expected: FAIL because source does not mention RPC helper module yet.

- [ ] **Step 3: Add non-default RPC roadmap comment**

Add a short comment near `launchBackend` explaining that RPC launch will use `extensions/lib/rpc-extension-ui.ts` later, while current default remains embedded JSON mode.

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/subagents-assets-discovery.test.ts`
Expected: PASS.

### Task 3: Full verification and merge decision

**Files:**
- All modified files.

- [ ] **Step 1: Run focused tests**

Run: `node --test tests/rpc-extension-ui.test.ts tests/subagents-assets-discovery.test.ts`
Expected: PASS.

- [ ] **Step 2: Run full suite**

Run: `node --test tests/*.test.ts`
Expected: 29 tests, 0 failures.

- [ ] **Step 3: Commit branch**

Run:
```bash
git add extensions/lib/rpc-extension-ui.ts extensions/subagents.ts tests/rpc-extension-ui.test.ts tests/subagents-assets-discovery.test.ts docs/superpowers/plans/2026-06-08-rpc-extension-ui-helpers.md
git commit -m "feat: add rpc extension ui helpers"
```

- [ ] **Step 4: Merge locally if requested**

If user asked for merge, fast-forward `main`, run full suite on `main`, remove worktree, delete branch.
