# Report Extension Design

## Goal

Add `extensions/report.ts`, a Pi extension that periodically asks the active agent for a short implementation-progress report and displays that report inline while the agent loop continues.

## User Outcome

When the main agent is working for a long time, the user can see a compact progress update in the conversation without stopping the agent. The default cadence is 10 minutes and can be changed from `~/.pi/agent/orgm.json`.

## Configuration

Add a new `report` slice to central ORGM config:

```json
{
  "report": {
    "enabled": true,
    "intervalMinutes": 10
  }
}
```

Rules:
- Missing config uses defaults: enabled, 10 minutes.
- `intervalMinutes` must be a positive finite number.
- Values below 1 minute are clamped or rejected back to the default to avoid noisy loops.
- The slice is readable through `loadOrgmConfigSlice("report")` and saveable through `saveOrgmConfigSlice("report", value)`.

## Architecture

### `extensions/lib/report-config.ts`

Small config wrapper matching existing patterns such as `agent-status-config.ts`:

- `ReportConfig`
- `REPORT_CONFIG_DEFAULTS`
- `getReportConfigPath()`
- `loadReportConfig(configPath?)`
- `saveReportConfig(config, configPath?)`

### `extensions/report.ts`

The extension owns only runtime reporting state:

- tracks when an agent loop starts and ends
- tracks turn count and latest tool activity
- records recent tool errors
- starts a timer on `agent_start`
- stops the timer on `agent_end` and `session_shutdown`
- on each interval, sends a steering user message asking the active agent to estimate progress and answer with a compact report

The report must include a percentage bar based on the consulted agent's estimate, for example:

```text
📊 Informe de avance · 40%
[####------] 40%
Estado: implementando tests
No hemos terminado porque: falta validar orgm.json y renderer inline
Falta: crear report-config.ts, report.ts y pruebas
Errores: ninguno detectado
```

The extension must not invent the percentage. It asks the active agent to estimate the implementation percentage from the current task context. The prompt tells the agent to return a single short inline report and continue the original work afterward.

## Data Flow

1. User sends a work request.
2. Pi emits `agent_start`.
3. `report.ts` loads config and arms a `setInterval` for `intervalMinutes`.
4. During execution, event hooks update local runtime facts:
   - `turn_start` increments turn/activity counters.
   - `tool_execution_end` records latest tool name and errors.
   - `turn_end` records latest turn timestamp.
5. Timer fires while agent is active.
6. Extension calls `pi.sendUserMessage(reportPrompt, { deliverAs: "steer" })`.
7. The active agent responds inline with the requested report, including `[####------]40%` style bar based on its own estimate.
8. Original loop continues.

## Prompt Contract

The periodic steering prompt should be short and explicit:

- Ask for an inline progress report only.
- Ask for an estimated percentage of the current commitment.
- Require the bar format `[####------]40%` with 10 slots.
- Require explanation of why the work is not finished.
- Require remaining work.
- Require errors/blockers if any.
- Tell the agent to be concise and then continue the original task.

## Error Handling

- If config loading fails, use defaults silently.
- If there is no active agent loop, do not emit reports.
- If `ctx.hasUI` is false, do not rely on UI-only calls. Steering messages can still work in interactive/RPC contexts, but the extension should avoid timer noise in print/json if not suitable.
- Timer cleanup is mandatory on `agent_end` and `session_shutdown`.

## Testing

Add tests for:

- `orgm-config.ts` default and custom `report` slice loading.
- `report-config.ts` wrapper behavior.
- `report.ts` timer lifecycle:
  - starts on `agent_start` when enabled
  - does not start when disabled
  - sends `pi.sendUserMessage(..., { deliverAs: "steer" })` after interval
  - includes percentage/bar instructions in the prompt
  - clears timer on `agent_end` or `session_shutdown`

## Non-goals

- No dashboard or widget in the first version.
- No independent second model call from the extension.
- No fabricated progress percentage from tool counts alone.
- No persistent report settings UI unless requested later.
