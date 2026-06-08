# RPC Extension UI Bridge Design

## Goal

Use Pi's exported `RpcExtensionUIRequest` and `RpcExtensionUIResponse` types to replace ad-hoc subagent interaction plumbing when a parent process runs child Pi instances through RPC or JSON automation.

## Current State

`extensions/ask.ts` and `extensions/subagents.ts` support subagent user interaction through `extensions/lib/subagent-interaction-bridge.ts`. The bridge writes `.request.json` and `.response.json` files under a temporary directory. This works in TUI parents, but it is file-based, untyped at the Pi protocol boundary, and separate from Pi's official extension UI protocol.

Pi now exports RPC extension UI request/response types from `@earendil-works/pi-coding-agent`, and RPC mode translates extension UI calls (`ctx.ui.select`, `confirm`, `input`, `editor`, `notify`, etc.) into typed `extension_ui_request` / `extension_ui_response` JSONL events.

## Proposed Direction

Keep the existing file bridge as a compatibility fallback, then add an RPC-first bridge for integrations that run child Pi in `--mode rpc`.

1. Add a small typed module, likely `extensions/lib/rpc-extension-ui.ts`, that imports:
   - `type RpcExtensionUIRequest`
   - `type RpcExtensionUIResponse`
2. Map current subagent interaction payloads to official RPC UI methods:
   - permission prompts -> `confirm` or `select`
   - ask-user questions with options -> `select`
   - freeform questions -> `input` or `editor`
   - status updates -> `notify` / `setStatus`
3. In `deploy_agent`, add a future launch path for RPC-backed child runs:
   - spawn child Pi with `--mode rpc`
   - read JSONL stdout
   - when `extension_ui_request` appears, relay it through parent `ctx.ui`
   - write matching `extension_ui_response` to child stdin
4. Preserve current JSON mode path as default until RPC path is stable.

## Trust and Safety

Project trust behavior should stay explicit:

- `projectTrust: inherit` uses saved trust/no-input state.
- `projectTrust: approve` passes `--approve` to child Pi.
- `projectTrust: no-approve` passes `--no-approve` to child Pi.

The RPC UI bridge must not silently approve permission requests. Permission prompts should remain visible to the user or return cancelled when parent UI is unavailable.

## Benefits

- One official protocol for extension UI instead of custom temp-file polling.
- Easier external dashboards: browser, desktop app, or daemon can drive Pi and answer UI requests.
- Better typing for future clients and tests.
- Cleaner path to remote/hosted orchestration where temp-file sharing is fragile.

## First Implementation Slice

Do not replace the file bridge immediately. First slice should be:

1. Add typed helpers that classify and validate `RpcExtensionUIRequest` / `RpcExtensionUIResponse` objects.
2. Add tests for request/response mapping.
3. Add an experimental `launchBackend: "rpc"` only if needed later; keep current `embedded` JSON path as default.

## Non-goals

- No change to default subagent launch behavior in this pass.
- No automatic trust decisions.
- No remote browser/dashboard implementation yet.
