# pi-loop Runtime Status Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix bundled `pi-loop` so Pi no longer throws `pi.setStatus is not a function`, while preserving `/orgm-loop` behavior and updating `pi-harness` so `pi update` installs the fixed revision.

**Architecture:** Keep ownership in `pi-loop`, where loop state is already emitted via `PI_LOOP_EVENT`. Preserve the crash fix in `pi-loop` and prove it with a focused regression test that rejects unsupported `ExtensionAPI` status calls. Then refresh `pi-harness` dependency resolution so installed bundle contents pick up the fixed `pi-loop` commit. `pi-footer` already listens to `PI_LOOP_EVENT` and renders `loopLabel`, so it is verification-only in this plan and should not change unless runtime evidence disproves the current design.

**Tech Stack:** Node.js 22, raw TypeScript extension files, Node built-in `node:test` in `pi-loop`, npm lockfile v3 in `pi-harness`, Pi CLI runtime smoke tests.

## Global Constraints

- Loading `pi-loop` must not throw `pi.setStatus is not a function`.
- `/orgm-loop on|off|status` must keep working.
- Loop continuation logic must remain unchanged unless required for supported status wiring.
- `pi update` on a harness install must fetch the fixed `pi-loop` revision.
- If loop status badge is preserved, it must use supported APIs only.
- Do not move loop implementation into `pi-harness`.
- Do not change `pi-footer` unless runtime verification proves current `PI_LOOP_EVENT`-driven badge wiring is insufficient.
- Preserve unrelated local changes already present in `/home/osmarg/Code/pi-harness/package.json`.

---

## File Structure

- `pi-loop/extensions/loop.ts` — owner implementation; must never call unsupported `ExtensionAPI` UI methods.
- `pi-loop/test/loop.test.mjs` — new focused regression test file using Node built-in test runner.
- `pi-loop/package.json` — add exact test script for the regression test.
- `pi-harness/package-lock.json` — refresh resolved `pi-loop` Git commit.
- `pi-harness/node_modules/pi-loop/extensions/loop.ts` — installed dependency copy to verify after npm refresh; never edit directly.
- `pi-harness/tests/harness-bundle-only.test.mjs` — existing bundle shape regression test; should keep passing unchanged.

## Pre-Verified Context

- `/home/osmarg/Code/pi-loop/extensions/loop.ts` already removed the bad `pi.setStatus(...)` call in local commit `c7015b6`.
- `/home/osmarg/Code/pi-footer/extensions/zentui/index.ts` already listens for `PI_LOOP_EVENT` and computes `_loopLabel`.
- `/home/osmarg/Code/pi-footer/extensions/zentui/ui.ts` already renders `loopLabel` in editor metadata.
- `/home/osmarg/Code/pi-harness` still resolves `pi-loop` to old commit `f715f81`, so the bundle remains broken until lockfile refresh.

### Task 1: Add a `pi-loop` regression test and lock in the owner fix

**Files:**
- Create: `/home/osmarg/Code/pi-loop/test/loop.test.mjs`
- Modify: `/home/osmarg/Code/pi-loop/package.json`
- Verify: `/home/osmarg/Code/pi-loop/extensions/loop.ts`

**Interfaces:**
- Consumes: `default export function loopExtension(pi: ExtensionAPI): void` from `/home/osmarg/Code/pi-loop/extensions/loop.ts`
- Produces: Regression proof that extension registration succeeds with an `ExtensionAPI` stub that has no `setStatus` method, and that `/orgm-loop on|off|status` command still registers.

- [ ] **Step 1: Write the failing regression test**

Create `/home/osmarg/Code/pi-loop/test/loop.test.mjs` with this content:

```js
import assert from "node:assert/strict";
import test from "node:test";
import loopExtension, { PI_LOOP_EVENT } from "../extensions/loop.ts";

function createPiStub() {
  const commandHandlers = new Map();
  const eventHandlers = new Map();
  const emitted = [];
  const userMessages = [];

  return {
    commandHandlers,
    eventHandlers,
    emitted,
    userMessages,
    api: {
      events: {
        emit(name, payload) {
          emitted.push({ name, payload });
        },
      },
      on(name, handler) {
        eventHandlers.set(name, handler);
      },
      registerCommand(name, options) {
        commandHandlers.set(name, options);
      },
      sendUserMessage(content, options) {
        userMessages.push({ content, options });
      },
    },
  };
}

test("loop extension registers without calling unsupported ExtensionAPI status methods", async () => {
  const stub = createPiStub();

  assert.doesNotThrow(() => loopExtension(stub.api));
  assert.equal(stub.commandHandlers.has("orgm-loop"), true);
  assert.equal(stub.eventHandlers.has("session_start"), true);
  assert.equal(stub.eventHandlers.has("agent_end"), true);
});

test("orgm-loop command toggles loop state through emitted events without crashing", async () => {
  const stub = createPiStub();
  loopExtension(stub.api);

  const command = stub.commandHandlers.get("orgm-loop");
  assert.ok(command, "expected orgm-loop command to be registered");

  const notifications = [];
  const ctx = {
    ui: {
      notify(message, level) {
        notifications.push({ message, level });
      },
    },
  };

  await command.handler("on", ctx);
  await command.handler("status", ctx);
  await command.handler("off", ctx);

  assert.deepEqual(
    stub.emitted.map((entry) => entry.name),
    [PI_LOOP_EVENT, PI_LOOP_EVENT],
  );
  assert.deepEqual(notifications, [
    { message: "Loop mode ON (max 25 iterations)", level: "success" },
    { message: "Loop: ON — iteration 0/25", level: "info" },
    { message: "Loop mode OFF", level: "info" },
  ]);
});
```

- [ ] **Step 2: Add test script before running**

Modify `/home/osmarg/Code/pi-loop/package.json` `scripts` block to this exact shape:

```json
"scripts": {
  "test": "node --test test/loop.test.mjs",
  "pack:check": "npm pack --dry-run"
}
```

- [ ] **Step 3: Run test to verify it fails for the right reason**

Run:

```bash
cd /home/osmarg/Code/pi-loop && npm test
```

Expected before any new implementation adjustments:
- `test("orgm-loop command toggles loop state through emitted events without crashing")` may fail if the current implementation or fixture assumptions do not yet match the real command behavior.
- It must not fail with syntax/import problems. If it does, fix the test harness only until the failure is about loop behavior.

- [ ] **Step 4: Implement the minimal owner code needed to satisfy the regression**

Keep `/home/osmarg/Code/pi-loop/extensions/loop.ts` aligned with this key helper body:

```ts
function emitState(pi: ExtensionAPI, active: boolean, iteration: number, maxIterations: number): void {
	pi.events.emit(PI_LOOP_EVENT, { active, iteration, maxIterations });
}
```

And keep the command branch behavior aligned with this exact shape:

```ts
			if (cmd === "on") {
				loopActive = true;
				emitState(pi, true, loopIteration, loopMaxIterations);
				ctx.ui.notify(`Loop mode ON (max ${loopMaxIterations} iterations)`, "success");
				return;
			}

			if (cmd === "off") {
				loopActive = false;
				loopIteration = 0;
				loopIsInjecting = false;
				emitState(pi, false, 0, loopMaxIterations);
				ctx.ui.notify("Loop mode OFF", "info");
				return;
			}
```

Important: do **not** reintroduce `pi.setStatus(...)`. If you must touch the file, keep all loop continuation and done-detection logic unchanged.

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
cd /home/osmarg/Code/pi-loop && npm test
```

Expected:
- `2` tests passing
- No `pi.setStatus` runtime error

- [ ] **Step 6: Run package verification**

Run:

```bash
cd /home/osmarg/Code/pi-loop && npm run pack:check
```

Expected:
- `npm pack --dry-run` succeeds

- [ ] **Step 7: Commit and push `pi-loop`**

Run:

```bash
cd /home/osmarg/Code/pi-loop && git add package.json test/loop.test.mjs extensions/loop.ts && git commit -m "fix: remove unsupported loop status API" && git push origin master
```

Expected:
- New remote commit on `master` containing regression test plus owner fix

### Task 2: Refresh `pi-harness` to resolve the fixed `pi-loop` revision

**Files:**
- Modify: `/home/osmarg/Code/pi-harness/package-lock.json`
- Verify: `/home/osmarg/Code/pi-harness/package.json`
- Verify: `/home/osmarg/Code/pi-harness/node_modules/pi-loop/extensions/loop.ts`
- Test: `/home/osmarg/Code/pi-harness/tests/harness-bundle-only.test.mjs`

**Interfaces:**
- Consumes: Published GitHub dependency declaration `"pi-loop": "github:osmargm1202/pi-loop"` from `/home/osmarg/Code/pi-harness/package.json`
- Produces: Lockfile and installed dependency tree resolving `pi-loop` to the new commit from Task 1.

- [ ] **Step 1: Confirm current harness dependency declaration stays unchanged**

Verify `/home/osmarg/Code/pi-harness/package.json` still contains:

```json
"pi-loop": "github:osmargm1202/pi-loop"
```

Do not edit `package.json` unless npm proves it is required for lock refresh. Preserve unrelated local changes already present in this file.

- [ ] **Step 2: Refresh the lockfile and installed dependency**

Run:

```bash
cd /home/osmarg/Code/pi-harness && npm install
```

Expected:
- `package-lock.json` updates the resolved `pi-loop` commit from `f715f81...` to the new Task 1 commit
- `node_modules/pi-loop/extensions/loop.ts` no longer contains `pi.setStatus(`

- [ ] **Step 3: Prove installed dependency content is fixed**

Run:

```bash
cd /home/osmarg/Code/pi-harness && npm ls pi-loop --depth=0 && rg -n "pi\.setStatus\(" node_modules/pi-loop/extensions/loop.ts
```

Expected:
- `npm ls` shows `pi-loop` at the new Git commit
- `rg` returns no matches

- [ ] **Step 4: Run bundle regression test**

Run:

```bash
cd /home/osmarg/Code/pi-harness && node --test tests/harness-bundle-only.test.mjs
```

Expected:
- PASS

- [ ] **Step 5: Run package dry-run verification**

Run:

```bash
cd /home/osmarg/Code/pi-harness && npm run pack:check
```

Expected:
- `npm pack --dry-run` succeeds

- [ ] **Step 6: Run non-interactive Pi load smoke**

Run:

```bash
cd /home/osmarg/Code/pi-harness && PI_OFFLINE=1 pi --no-extensions -e /home/osmarg/Code/pi-harness --list-models
```

Expected:
- Command completes successfully
- No `pi.setStatus is not a function` error from `node_modules/pi-loop/extensions/loop.ts`

- [ ] **Step 7: Commit and push `pi-harness`**

Run:

```bash
cd /home/osmarg/Code/pi-harness && git add package-lock.json package.json && git commit -m "fix: refresh pi-loop bundle dependency" && git push origin main
```

Expected:
- Harness remote points at lockfile with fixed `pi-loop` revision

## Self-Review

- **Spec coverage:** Task 1 covers owner fix, no-crash guarantee, and `/orgm-loop` command behavior. Task 2 covers `pi update` path via lock refresh and bundle verification. `pi-footer` is intentionally excluded from code changes because current source already satisfies the event-driven badge requirement from the spec.
- **Placeholder scan:** No `TODO`, `TBD`, or vague “write tests” language remains. Each task has exact files and commands.
- **Type consistency:** Plan uses existing `loopExtension(pi: ExtensionAPI)` default export, `PI_LOOP_EVENT` constant, and `handler(args, ctx)` command shape from current source.
