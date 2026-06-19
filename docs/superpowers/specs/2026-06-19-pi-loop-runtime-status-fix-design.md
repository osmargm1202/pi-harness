# pi-loop Runtime Status Fix Design Spec

**Date:** 2026-06-19  
**Status:** Approved

## Overview

`pi-loop` currently crashes at runtime in bundled installs because old shipped code calls `pi.setStatus(...)`, but the supported Pi extension UI API exposes status updates through `ctx.ui.setStatus(...)` instead.

Local `pi-loop` repo already contains a crash-only fix commit (`c7015b6`) that removes the unsupported call. `pi-harness` still pins an older `pi-loop` commit (`f715f81`), so `pi update` continues to install broken code.

Goal: fix the owner package and update the harness bundle so future installs and updates pick up the corrected implementation.

## Repos Touched

| Repo | Change |
|------|--------|
| `pi-loop` | Replace unsupported status API usage with supported runtime behavior; keep loop feature working without startup/runtime crash |
| `pi-footer` | Only touch if preserving loop badge requires footer-side wiring beyond current behavior |
| `pi-harness` | Refresh dependency lock/pin so bundled installs resolve to fixed `pi-loop` commit |

## Root Cause

Broken code path in historical `pi-loop/extensions/loop.ts`:

```ts
pi.setStatus("loop", active ? `⟳ LOOP:${iteration}/${maxIterations}` : undefined);
```

Evidence from installed Pi package typings and examples:
- `ExtensionAPI` supports `registerCommand`, `sendUserMessage`, events, etc.
- Status rendering is performed via `ctx.ui.setStatus(...)`, not `pi.setStatus(...)`
- Existing Pi examples update footer status from event handlers using the extension context

Therefore the crash is caused by using a non-existent `ExtensionAPI` method in a bundled extension version still pinned by `pi-harness`.

## Desired Behavior

1. Loading `pi-loop` must not throw `pi.setStatus is not a function`
2. `/orgm-loop on|off|status` must keep working
3. Loop continuation logic must remain unchanged unless required for supported status wiring
4. `pi update` on a harness install must fetch the fixed `pi-loop` revision
5. If loop status badge is preserved, it must use supported APIs only

## Approach

### Recommended path

1. **Fix `pi-loop` in owner repo**
   - Keep crash fix as baseline
   - Prefer supported status behavior if it can be implemented cleanly
   - Avoid broad refactors or moving ownership into `pi-harness`

2. **Touch `pi-footer` only if required**
   - If current loop event/badge path already works, no footer change
   - If badge was depending on removed behavior, add minimal footer/runtime wiring there

3. **Update `pi-harness` dependency resolution**
   - Refresh lock/pin to fixed `pi-loop` commit
   - Keep bundle manifest intact unless package ownership changes

## Design Details

### `pi-loop`

- Preserve `PI_LOOP_EVENT` event emission for loop state changes
- Replace unsupported direct API usage with one of these supported patterns:
  - **Preferred:** publish loop state by event and/or use `ctx.ui.setStatus(...)` only inside handlers that already receive `ctx`
  - **Fallback:** omit direct footer status text from `pi-loop` if footer already derives label from emitted event state
- Do not call UI APIs from helper functions that only receive `pi: ExtensionAPI`

### `pi-footer`

- Verify whether footer loop indicator is already driven by `PI_LOOP_EVENT`
- If yes, no change
- If no, add minimal event-driven rendering so loop badge comes from shared state rather than unsupported direct extension API calls

### `pi-harness`

- Update installed `pi-loop` dependency reference in `package-lock.json`
- Leave `package.json` dependency declaration as GitHub package unless a versioning/pinning change is truly needed
- Do not add local runtime code to the harness

## Testing / Verification

### `pi-loop`

- Add/adjust a focused regression test if repo has or can support one cheaply
- At minimum verify by inspecting built/runtime source and loading extension through Pi without the old error

### `pi-harness`

- Reinstall or refresh dependency so `node_modules/pi-loop/extensions/loop.ts` matches fixed owner repo
- Run bundle verification relevant to changed surface:
  - `node --test tests/harness-bundle-only.test.mjs`
  - `npm run pack:check`
  - `PI_OFFLINE=1 pi --no-extensions -e /home/osmarg/Code/pi-harness --list-models`
- If bundle install path changes materially, also smoke test install/update flow

## Out of Scope

- Redesigning loop semantics
- Moving loop implementation into `pi-harness`
- Broad footer refactors unrelated to loop status
- New loop configuration features

## Success Criteria

- No runtime `pi.setStatus` error from bundled `pi-loop`
- Loop command remains available and functional
- Harness-resolved `pi-loop` points to fixed commit after update
- Changes committed and pushed in owner repo(s) touched
