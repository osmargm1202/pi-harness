# pi-loop Design Spec

**Date:** 2026-06-17  
**Status:** Approved

## Overview

A pi extension that keeps the agent looping after each response until the task is genuinely complete. Activated per-session via `/orgm-loop on|off`. Footer shows `⟳ LOOP:N/MAX` badge. Config stored in orgm.json.

Inspired by: Ralph Wiggum loop (snarktank/ralph) and Gas Town (Steve Yegge). Core mechanism adapted for pi's ExtensionAPI.

---

## Repos Touched

| Repo | Change |
|------|--------|
| `pi-loop` (new) | New extension: loop engine, command, config |
| `pi-footer` | Add loop badge to editor metadata line |
| `pi-harness` | Add pi-loop to `pi.extensions` + dependencies |

---

## Architecture

### Loop Engine (pi-loop)

**Lifecycle hooks used:**

| Event | Purpose |
|-------|---------|
| `session_start` | Reset in-memory loop state |
| `before_agent_start` | Inject loop system prompt when active; detect new user turn vs loop turn |
| `agent_end` | Scan for `[LOOP:DONE]`; inject continuation message or stop |

**State (in-memory, ephemeral per session):**
```typescript
let loopActive = false;
let loopIteration = 0;
let loopIsInjecting = false; // true when we fired sendUserMessage
const loopMaxIterations = 25; // from orgm.json, default 25
```

**Done detection:**  
Agent must include `[LOOP:DONE]` in its response text. Extension scans `AgentEndEvent.messages` — last assistant message text. If found → stop. If not found and `loopIteration < loopMaxIterations` → continue. If limit hit → warn and stop.

**Iteration reset:**  
On `before_agent_start`: if `loopIsInjecting === false` (user sent a real message), reset `loopIteration = 0`. Set `loopIsInjecting = false` after check.

---

### System Prompt Injection

Returned via `before_agent_start` handler as `{ systemPrompt: replacedPrompt }`.  
Appended block (does not replace, appends to existing):

```
## Loop Mode Active (iteration N/MAX)

You are in loop mode. Work until the task is COMPLETELY done.

Rules:
1. Never simplify if the user asked for something complex — take the correct path even if it takes longer
2. Before declaring done: verify your changes are NEW and actually present in the code (check git diff or file contents — do not assume something is done)
3. Resolve ambiguity with the most comprehensive approach that fits the main objective
4. When TRULY complete: include [LOOP:DONE] at the very end of your response
5. Do NOT include [LOOP:DONE] if any work remains
```

---

### Continuation Message

Injected via `pi.sendUserMessage(text, { deliverAs: "nextTurn" })` after each non-done `agent_end`:

```
Continue. Check: is the original task fully complete?
- Verify your changes actually exist in the code (not just planned)
- If you simplified something complex, redo it properly  
- Resolve any remaining ambiguity with the most fitting approach
- Only end with [LOOP:DONE] when truly done
```

---

### Command: `/orgm-loop`

| Args | Behavior |
|------|----------|
| `on` | Set `loopActive = true`; update footer; notify |
| `off` | Set `loopActive = false`; clear footer; notify |
| `status` | Show: active state, iteration count, max |
| _(none)_ | Same as `status` |

Completions: `on`, `off`, `status`.

---

### Config (orgm.json)

```json
{
  "extensions": {
    "loop": { "enabled": true }
  },
  "loop": {
    "maxIterations": 25
  }
}
```

`extensions.loop.enabled` — controls whether extension registers at all (follows orgm pattern).  
`loop.maxIterations` — guard against infinite loops. Default: 25.

Loaded via `loadOrgmConfigSlice("loop")` for the `maxIterations` value.

---

### Footer Badge (pi-footer)

**Event emitted by pi-loop:**
```typescript
export const PI_LOOP_EVENT = "pi-loop:state-changed";
// payload: { active: boolean, iteration: number, maxIterations: number }
```

**pi-footer changes:**
- `index.ts`: listen to `PI_LOOP_EVENT` via `pi.events.on()`, store loop state
- `ui.ts`: render `⟳ LOOP:N/MAX` in editor metadata line (`metaParts`)  
  - Style: `selectedBg` + `text` theme colors (same pattern as session label)  
  - Only shown when `active === true`

Badge placement: in `metaParts` array alongside session label. Loop badge comes after session label.

---

## File Layout

### pi-loop

```
pi-loop/
├── package.json
└── extensions/
    ├── loop.ts              # main extension
    └── lib/
        ├── orgm-config.ts          # copied from pi-rename
        ├── orgm-config-path.ts     # copied from pi-rename
        └── orgm-extension-config.ts # copied from pi-rename
```

### pi-footer changes

- `extensions/zentui/index.ts` — add PI_LOOP_EVENT listener + `getLoopLabel()` getter
- `extensions/zentui/ui.ts` — add `loopLabel?: string` to state, render in metaParts

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Max iterations hit | Deactivate loop, `ctx.ui.notify("Loop stopped: max iterations (N) reached", "warning")` |
| Agent crashes mid-turn | `agent_end` still fires (with partial messages); extension continues normally |
| `[LOOP:DONE]` in non-final turn | Ignored — only scanned in last assistant message of `AgentEndEvent.messages` |
| Loop activated during active agent turn | Applies starting next `agent_end` |

---

## Sequence Diagram

```
User: /orgm-loop on
  → loopActive = true, emit PI_LOOP_EVENT, show ⟳ LOOP:0/25

User: <task prompt>
  → before_agent_start: loopIsInjecting=false → reset iteration=0; inject loop system prompt
  → agent works...
  → agent_end: scan messages for [LOOP:DONE] → not found
  → loopIsInjecting=true, iteration=1, emit PI_LOOP_EVENT (⟳ LOOP:1/25)
  → sendUserMessage(continuationPrompt, { deliverAs: "nextTurn" })

  → before_agent_start: loopIsInjecting=true → keep iteration; inject loop system prompt
  → agent works...
  → agent_end: scan messages → found [LOOP:DONE]
  → loopActive=false, emit PI_LOOP_EVENT (active=false), clear badge
  → notify: "Loop complete after 2 iterations"
```

---

## Out of Scope (v1)

- Persistent loop active state across sessions (always ephemeral)
- Per-project custom continuation prompts (fixed prompts in v1)
- Task list parsing from agent output (agent manages internally)
- Multiple loop profiles
