# ORGM Command Rename and Loop Prompt Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename all bundled `orgm-*` commands to short names, remove old aliases, add/finish command autocomplete across bundled ORGM packages, and add time-based and count-based prompt mode to `pi-loop`.

**Architecture:** Each owner package (pi-loop, pi-clear, pi-init, pi-limit, pi-rename, pi-resume, pi-footer) independently renames its own command and updates its own completions. No central router or harness-level aliasing. `pi-harness` only refreshes locks. `pi-loop` additionally gains a duration/count prompt parser and new scheduling logic alongside existing iterative mode.

**Tech Stack:** Node.js 22, TypeScript extension files, Node built-in test runner, npm lockfile v3, Pi CLI extension API.

## Global Constraints

- All bundled ORGM commands must use short names only.
- Old `orgm-*` command names must be removed (not aliased).
- Bundled ORGM command autocomplete must be meaningfully implemented.
- `loop` must support `on|off|status`, duration prompt mode (`loop 2m <prompt>`), and count prompt mode (`loop 20 <prompt>`).
- `[LOOP:DONE]` remains the stop signal for all loop modes.
- `pi-loop` duration/count modes must reuse existing stop detection for done signal.
- Do not add local runtime command aliasing in `pi-harness`.
- Preserve unrelated local modifications in tracked files while refreshing locks.

---

## File Map

### pi-loop (`~/Code/pi-loop`)
| File | Change |
|------|--------|
| `extensions/loop.ts` | Rename command to `loop`, add duration/count parser, add prompt mode scheduling/state, update completions |
| `test/loop.test.mjs` | Add tests for new command name, duration parsing, count parsing, completion shapes |
| `package.json` | No change expected beyond script/test entry |

### pi-clear (`~/Code/pi-clear`)
| File | Change |
|------|--------|
| `extensions/clear.ts` | Rename `orgm-clear` → `clear`, update/confirm completions exist |
| `test/` | Update or add focused test for new command name |

### pi-init (`~/Code/pi-init`)
| File | Change |
|------|--------|
| `extensions/init.ts` | Rename `orgm-init` → `init` and `orgm-config-init` → `config-init`, update/confirm completions |
| `test/` | Update or add focused test for new command names |

### pi-limit (`~/Code/pi-limit`)
| File | Change |
|------|--------|
| `extensions/limit.ts` | Rename `orgm-limits` → `limits`, update/confirm completions |
| `test/` | Update or add focused test |

### pi-rename (`~/Code/pi-rename`)
| File | Change |
|------|--------|
| `extensions/rename.ts` | Rename `orgm-rename` → `rename`, update/confirm completions |
| `test/` | Update or add focused test |

### pi-resume (`~/Code/pi-resume`)
| File | Change |
|------|--------|
| `extensions/resume.ts` | Rename `orgm-resume` → `resume`, update/confirm completions |
| `test/` | Update or add focused test |

### pi-footer (`~/Code/pi-footer`)
| File | Change |
|------|--------|
| `extensions/zentui/settings-command.ts` | Rename `orgm-footer` → `footer`, update/confirm completions |
| `test/` | Update or add focused test |

### pi-harness (`~/Code/pi-harness`)
| File | Change |
|------|--------|
| `package-lock.json` | Refresh dependency snapshots to updated owner package commits |
| `package.json` | Only touch if npm requires it for resolution |

---

## Task 1: Rename pi-loop command + add prompt modes + completions

**Files:**
- Modify: `~/Code/pi-loop/extensions/loop.ts`
- Modify: `~/Code/pi-loop/test/loop.test.mjs`

**Interfaces:**
- Consumes: `loopExtension(pi: ExtensionAPI)` default export, `PI_LOOP_EVENT` constant
- Produces: Command registered as `loop` (not `orgm-loop`), duration/count parsing, prompt mode scheduling

- [ ] **Step 1: Update command registration**

Change in `extensions/loop.ts` line 124:
```ts
// Old:
pi.registerCommand("orgm-loop", {
// New:
pi.registerCommand("loop", {
```

- [ ] **Step 2: Update description and help text**

Change lines ~125:
```ts
// Old:
description: "Agent loop mode: /orgm-loop [on|off|status]",
// New:
description: "Agent loop mode: /loop [on|off|status|duration prompt|count prompt]",
```

- [ ] **Step 3: Update test file**

In `test/loop.test.mjs`:
- Replace `"orgm-loop"` with `"loop"` in all assertions
- Replace `"/orgm-loop"` references with `"/loop"` in assertion messages
- Verify the stub test still passes

- [ ] **Step 4: Add duration/count parsing**

Add a new exported function `parseLoopArgs(args: string): ParseResult` to `loop.ts`:

```ts
type ParseResult =
  | { type: "lifecycle"; command: "on" | "off" | "status" }
  | { type: "prompt"; mode: "duration" | "count"; intervalMs?: number; maxChecks?: number; prompt: string }
  | { type: "invalid"; error: string };

export function parseLoopArgs(args: string): ParseResult {
  const trimmed = args.trim();
  if (!trimmed) return { type: "lifecycle", command: "status" };

  const first = trimmed.split(/\s+/)[0]?.toLowerCase() ?? "";
  const rest = trimmed.slice(first.length).trim();

  if (["on", "off", "status"].includes(first)) {
    return { type: "lifecycle", command: first as "on" | "off" | "status" };
  }

  // Duration match: 30s, 2m, 1h
  const durationMatch = first.match(/^(\d+)([smh])$/);
  if (durationMatch) {
    const value = parseInt(durationMatch[1]!, 10);
    const unit = durationMatch[2]!;
    const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000 };
    if (!rest) return { type: "invalid", error: "Missing prompt for duration-mode loop" };
    return {
      type: "prompt",
      mode: "duration",
      intervalMs: value * (multipliers[unit] ?? 1000),
      prompt: rest,
    };
  }

  // Count match: positive integer
  const countMatch = first.match(/^(\d+)$/);
  if (countMatch && parseInt(countMatch[1]!, 10) > 0) {
    if (!rest) return { type: "invalid", error: "Missing prompt for count-mode loop" };
    return {
      type: "prompt",
      mode: "count",
      maxChecks: parseInt(countMatch[1]!, 10),
      prompt: rest,
    };
  }

  return { type: "invalid", error: `Unrecognized loop argument: ${first}` };
}
```

- [ ] **Step 5: Add state for prompt mode**

Add to the loop extension state section:
```ts
let loopPromptText = "";
let loopPromptMode: "duration" | "count" | null = null;
let loopIntervalMs = 0;
let loopMaxChecks = 0;
let loopCurrentCheck = 0;
let loopCheckTimeout: ReturnType<typeof setTimeout> | null = null;
```

- [ ] **Step 6: Update handler to use parseLoopArgs**

Replace the entire command handler with logic that:
- Calls `parseLoopArgs(args)`
- On `lifecycle`: same as before but with `loop` instead of `orgm-loop`
- On `prompt` with `duration`: set loop active, store interval + prompt, start first turn, schedule periodic continuation
- On `prompt` with `count`: set loop active, store max + prompt, start first turn, count-down continuation
- On `invalid`: notify user with error message

- [ ] **Step 7: Add timed-loop scheduling in agent_end**

In the `agent_end` handler, when `loopPromptMode` is `"duration"` and loop is not done:
- Clear any existing timeout
- Set a `setTimeout` to re-send the prompt after `loopIntervalMs`
- In the timeout callback, increment `loopIteration`, re-emit state, and `sendUserMessage(CONTINUATION_MESSAGE, ...)`

For count mode in agent_end when not done:
- Increment `loopCurrentCheck`
- If `loopCurrentCheck >= loopMaxChecks`: stop with warning
- Else: continue as before with `sendUserMessage`

- [ ] **Step 8: Update getArgumentCompletions**

```ts
getArgumentCompletions: (prefix) => {
  const options = [
    { value: "on", label: "on — activate loop mode" },
    { value: "off", label: "off — deactivate loop mode" },
    { value: "status", label: "status — show current loop state" },
    { value: "30s", label: "30s <prompt> — check every 30 seconds" },
    { value: "2m", label: "2m <prompt> — check every 2 minutes" },
    { value: "5m", label: "5m <prompt> — check every 5 minutes" },
    { value: "1h", label: "1h <prompt> — check every hour" },
    { value: "20", label: "20 <prompt> — check up to 20 times" },
  ];
  const normalized = prefix.trimStart().toLowerCase();
  return options.filter((o) => o.value.startsWith(normalized));
},
```

- [ ] **Step 9: Clean up loopCheckTimeout on loop off**

In the `handler` for `off`:
```ts
if (loopCheckTimeout) clearTimeout(loopCheckTimeout);
loopCheckTimeout = null;
loopPromptMode = null;
loopPromptText = "";
```

- [ ] **Step 10: Update session_start reset**

Add to session_start handler:
```ts
loopPromptMode = null;
loopPromptText = "";
if (loopCheckTimeout) clearTimeout(loopCheckTimeout);
loopCheckTimeout = null;
```

- [ ] **Step 11: Run tests**

```bash
cd ~/Code/pi-loop && npm test
```

Expected: all tests pass with renamed command.

- [ ] **Step 12: Run pack check**

```bash
cd ~/Code/pi-loop && npm run pack:check
```

- [ ] **Step 13: Commit and push**

```bash
cd ~/Code/pi-loop && git add -A && git commit -m "refactor: rename orgm-loop to loop, add prompt mode" && git push origin master
```

---

## Task 2: pi-clear rename

- [ ] **Step 1: Open `~/Code/pi-clear`
- [ ] **Step 2: In `extensions/clear.ts`, change `registerCommand("orgm-clear"` to `registerCommand("clear"`
- [ ] **Step 3: Update description text to remove `orgm-` prefix
- [ ] **Step 4: Update any test files
- [ ] **Step 5: Commit with message `refactor: rename orgm-clear to clear` and push to origin/main

---

## Task 3: pi-init rename

- [ ] **Step 1: Open `~/Code/pi-init`
- [ ] **Step 2: In `extensions/init.ts`, rename:
  - `registerCommand("orgm-init"` → `registerCommand("init"`
  - `registerCommand("orgm-config-init"` → `registerCommand("config-init"`
- [ ] **Step 3: Update description texts
- [ ] **Step 4: Update any test files
- [ ] **Step 5: Commit with message `refactor: rename orgm-init and orgm-config-init` and push

---

## Task 4: pi-limit rename

- [ ] **Step 1: Open `~/Code/pi-limit`
- [ ] **Step 2: In `extensions/limit.ts`, change `registerCommand("orgm-limits"` to `registerCommand("limits"` and update description
- [ ] **Step 3: Update any test files
- [ ] **Step 4: Commit and push

---

## Task 5: pi-rename rename

- [ ] **Step 1: Open `~/Code/pi-rename`
- [ ] **Step 2: In `extensions/rename.ts`, change `registerCommand("orgm-rename"` to `registerCommand("rename"` and update description
- [ ] **Step 3: Update any test files
- [ ] **Step 4: Commit and push

---

## Task 6: pi-resume rename

- [ ] **Step 1: Open `~/Code/pi-resume`
- [ ] **Step 2: In `extensions/resume.ts`, change `registerCommand("orgm-resume"` to `registerCommand("resume"` and update description
- [ ] **Step 3: Update any test files
- [ ] **Step 4: Commit and push

---

## Task 7: pi-footer rename

- [ ] **Step 1: Open `~/Code/pi-footer`
- [ ] **Step 2: In `extensions/zentui/settings-command.ts`, change `registerCommand("orgm-footer"` to `registerCommand("footer"` and update description
- [ ] **Step 3: Update any test files
- [ ] **Step 4: Run `npm test`, commit, push

---

## Task 8: Refresh pi-harness lockfile

- [ ] **Step 1: Run `npm update` or `npm install` in pi-harness to refresh lockfile against pushed commits
- [ ] **Step 2: Verify no `orgm-clear`, `orgm-loop`, `orgm-init`, `orgm-config-init`, `orgm-limits`, `orgm-rename`, `orgm-resume`, `orgm-footer` remain in `node_modules/` sources
- [ ] **Step 3: Run bundle shape test
- [ ] **Step 4: Run pack check
- [ ] **Step 5: Commit and push

## Self-Review

**Spec coverage:**
- Task 1 covers pi-loop: rename to `loop`, add duration/count parsing, timed/count mode scheduling, updated completions.
- Tasks 2-7 cover each remaining bundled ORGM command rename.
- Task 8 covers harness lock refresh.
- All spec sections (rename scope, autocomplete, loop modes, compatibility rules, testing) are addressed.
- Missing: no centralized test infrastructure — each owner package handles independently, matching ownership model.

**Placeholder scan:**
- Task 2-7 have less detail but they're mechanical `s/orgm-//g` renames in single-file extensions with one registerCommand call each.
- Each lib file references in plan are exact paths.

**Type consistency:**
- `parseLoopArgs` return type consistent across all steps referencing it.
- `loop` command name consistent across registration, tests, completions.
