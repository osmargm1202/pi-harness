# full-subagents Extension Design

Date: 2026-05-26
Status: Approved for implementation planning

## Goal

Build a Pi extension stack that keeps a configurable team of real, persistent Pi subagents alive during the parent session, then makes the parent agent delegate meaningful work to those subagents by default.

## Scope

### In scope for MVP

- A new extension entrypoint: `extensions/full-subagents.ts`.
- A communication/runtime module: `extensions/lib/full-subagents-com.ts`.
- A widget rendering module: `extensions/lib/full-subagents-widget.ts`.
- A config merge/validation module: `extensions/lib/full-subagents-config.ts`.
- `orgm.json.fullSubagents` configuration for startup teams, agent limits, strict delegation, and per-agent overrides.
- Persistent subagent pool for the active parent Pi session.
- Headless child Pi processes with isolated context, model, tools, skills, MCP, extensions, and compaction behavior.
- TDD-first tests for config, protocol/state, widget rendering, and extension integration using fake transports.

### Out of scope for MVP

- Embedding multiple full interactive TUIs inside one Pi TUI.
- Requiring tmux/kitty/Hyprland windows for normal operation.
- A distributed multi-machine protocol.
- Verified long-term runtime reuse across parent Pi restarts.
- Replacing the existing `extensions/subagents.ts` immediately; this MVP can coexist with it.

## User-facing behavior

When `fullSubagents.enabled` is true, the extension reads `orgm.json`, resolves the startup team, and starts each configured subagent near session startup. The parent TUI shows a live widget with each subagent's name, status, model, context usage, compaction count, current task, and health.

The parent agent runs in strict delegation mode by default. It may answer direct coordination or clarification messages itself, but meaningful code/design/review/debug work must be delegated through the full-subagents tools.

## Configuration

The initial config lives under the existing ORGM host config file at `~/.pi/agent/orgm.json`:

```json
{
  "fullSubagents": {
    "enabled": true,
    "strictDelegation": true,
    "startupTeam": "tdd-core",
    "maxAgents": 10,
    "teams": {
      "tdd-core": [
        "tdd-brainstormer",
        "tdd-planner",
        "tdd-implementer",
        "tdd-reviewer",
        "tdd-verifier"
      ]
    },
    "agents": {
      "tdd-implementer": {
        "model": "provider/model",
        "tools": "all",
        "skills": "all",
        "mcp": "inherit",
        "extensions": "inherit"
      }
    }
  }
}
```

### Config rules

- `enabled` defaults to `false` for safe rollout unless the user explicitly enables it.
- `strictDelegation` defaults to `true` when `enabled` is true.
- `maxAgents` defaults to `5` and is clamped to `1..10`.
- `startupTeam` chooses the team to start on session startup.
- `teams` maps team names to agent names. The first MVP should support `tdd-core` well.
- `agents` contains optional per-agent overrides.
- `tools`, `skills`, `mcp`, and `extensions` accept one of: `"inherit"`, `"all"`, `"none"`, or a string array of explicit names.
- Project/user agent discovery should reuse the existing `agent-discovery` patterns where possible.

## Architecture

### `extensions/full-subagents.ts`

Responsibilities:

- Load `fullSubagents` config during `session_start`.
- Start the configured startup team when enabled.
- Register the parent-facing tools:
  - `full_subagent_task` for assigning one task to one subagent.
  - `full_query_team` for assigning parallel or serial work to a configured team.
- Register commands:
  - `/full-subagents` to show pool status.
  - `/full-subagents restart <agent>` to restart a failed or stuck subagent.
  - `/full-subagents team <name>` to switch/launch another configured team.
- Inject strict delegation guidance in `before_agent_start` when strict mode is enabled.
- Bridge runtime state into `full-subagents-widget.ts`.
- Shut down child processes on `session_shutdown`.

### `extensions/lib/full-subagents-com.ts`

Responsibilities:

- Own child process lifecycle and request routing.
- Spawn child Pi processes in headless JSON/RPC-oriented mode.
- Track agent state: `starting`, `idle`, `busy`, `compacting`, `awaiting_user`, `error`, `dead`.
- Serialize and parse protocol messages.
- Provide heartbeat, timeout, cancellation, restart, and transcript logging.
- Expose a testable transport interface so unit tests can use fake child transports instead of spawning real Pi processes.

The MVP protocol should prefer JSONL/RPC over stdio. Filesystem artifacts are useful for durable transcripts and recovery, but not as the primary request/response channel.

### `extensions/lib/full-subagents-widget.ts`

Responsibilities:

- Render a compact persistent widget with one card per subagent.
- Use vivid/accent color for `busy` and `compacting`.
- Use success/green or muted color for healthy `idle`.
- Use red/warning/gray for `error` and `dead`.
- Show, when available: short agent name, model, context percent, compaction count, current task/activity, tools/skills summary, and last result/error.
- Truncate every line safely with `truncateToWidth` and keep layout responsive.

### `extensions/lib/full-subagents-config.ts`

Responsibilities:

- Define `FullSubagentsConfig` types.
- Provide defaults and safe merge behavior for `orgm.json.fullSubagents`.
- Validate/clamp values, especially `maxAgents` and team names.
- Keep this independent from the extension runtime so tests can cover config without Pi UI.

## Communication protocol

Parent-to-child messages:

- `task.start`: assign a task with request id, task text, cwd, mode, and metadata.
- `task.cancel`: cancel an active request.
- `compact.request`: request child compaction.
- `shutdown`: graceful child shutdown.

Child-to-parent messages:

- `ready`: child is initialized and can accept work.
- `heartbeat`: child is alive and reports state.
- `status`: current state/activity/model/context/compaction count.
- `tool_event`: child tool start/update/end summary.
- `message_delta`: assistant text or progress preview.
- `task.done`: final result for a request.
- `task.error`: structured failure for a request.

Each message includes at minimum:

- `protocolVersion`.
- `agentId`.
- `requestId` when tied to a task.
- `type`.
- `timestamp`.

## Strict delegation mode

When enabled, the extension adds clear instructions to the parent system prompt:

- The parent is an orchestrator, not the main implementer.
- For meaningful work, the parent must choose an available subagent or team.
- The parent may answer directly only for clarification, coordination, small summaries, or selecting the next delegation step.
- If no appropriate subagent is available, the parent should report that state and suggest a restart or team change.

This is guidance rather than a hard security boundary. It should be visible and testable by checking the injected prompt text.

## Error handling and recovery

- Missing configured team: show widget warning and expose command feedback; do not crash Pi startup.
- Unknown agent in team: mark team degraded and list missing agents.
- Child exits unexpectedly: mark `dead`, keep last transcript, allow restart.
- Heartbeat timeout: mark `dead` or `error` based on last state.
- Task timeout: cancel child request and return structured error to parent agent.
- Protocol parse error: log malformed line, increment error count, keep process alive unless repeated failures cross a threshold.
- Parent shutdown: send `shutdown`, then force kill children after a short timeout.

## Testing strategy

Use TDD before implementation.

- `tests/full-subagents-config.test.ts`
  - Defaults when config missing.
  - Merge with `orgm.json` slices.
  - Clamp `maxAgents` to `1..10`.
  - Resolve `tdd-core` team and per-agent overrides.
- `tests/full-subagents-com.test.ts`
  - Message encode/decode.
  - State transitions for ready, busy, done, error, dead.
  - Heartbeat timeout and restart behavior using fake timers/fake transport.
  - Cancellation sends correct protocol message.
- `tests/full-subagents-widget.test.ts`
  - Idle/busy/dead colors or labels appear.
  - Long names/tasks truncate safely.
  - Context and compact count render when enabled.
- `tests/full-subagents-extension.test.ts`
  - Extension registers tools/commands.
  - Strict delegation prompt injection is present when enabled.
  - Fake pool receives `full_subagent_task` and `full_query_team` calls.

## Rollout plan

1. Implement config module and tests.
2. Implement protocol types, fake transport, and state machine tests.
3. Implement widget rendering tests and module.
4. Implement extension integration with fake transport first.
5. Add real child process transport.
6. Wire startup team from `orgm.json`.
7. Dogfood with `tdd-core` team.

## Open design decisions for implementation planning

- Exact Pi subprocess mode: prefer long-running RPC if available; otherwise create a minimal JSONL child runner around Pi subprocess behavior.
- Exact inheritance semantics for MCP and extensions may need validation against Pi runtime capabilities.
- The first implementation should avoid opening external terminal windows; a later debug backend can add tmux/kitty panes.
