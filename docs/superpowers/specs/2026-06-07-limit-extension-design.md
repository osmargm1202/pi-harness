# Limit Extension Design

## Goal

Add `extensions/limit.ts` to show remaining ChatGPT/Codex usage limits in a new minimal context row below the existing folder/mode/title row.

## Approved Layout

Minimal context area uses two rows:

```text
<folder>                         PLAN                         <title>
Codex 5H [#######---] 90% | Codex S [#########-] 92% | Spark 5H [#####-----] 50% | Spark S [########--] 80%
```

Where:

- `<folder>` is the current working directory basename, matching the existing minimal title-context row behavior.
- `PLAN` is the current ORGM mode label, still centered.
- `<title>` is the current generated session title/status, still right aligned.
- `Codex 5H` is the main Codex remaining primary usage window.
- `Codex S` is the main Codex remaining secondary/weekly usage window.
- `Spark 5H` is the Spark remaining primary usage window from `additional_rate_limits`.
- `Spark S` is the Spark remaining secondary/weekly usage window from `additional_rate_limits`.

The existing folder/mode/title row stays clean. The new limits row appears directly below it.

## Data Source

Use the endpoint used by the official OpenAI Codex client:

```http
GET https://chatgpt.com/backend-api/wham/usage
Authorization: Bearer <access_token>
ChatGPT-Account-Id: <account_id>
Accept: application/json
User-Agent: codex-cli
```

Official Codex also supports an alternate path style:

```http
GET {base}/api/codex/usage
```

For this extension, use `https://chatgpt.com/backend-api/wham/usage` first.

Expected response fields:

```json
{
  "plan_type": "pro",
  "rate_limit": {
    "primary_window": {
      "used_percent": 15,
      "reset_at": 1735401600,
      "limit_window_seconds": 18000
    },
    "secondary_window": {
      "used_percent": 5,
      "reset_at": 1735920000,
      "limit_window_seconds": 604800
    }
  },
  "additional_rate_limits": [],
  "credits": {
    "has_credits": true,
    "unlimited": false,
    "balance": "150.0"
  }
}
```

Interpretation:

- `rate_limit.primary_window.used_percent` is consumed percent for the short window, normally 5 hours (`18000` seconds).
- `rate_limit.secondary_window.used_percent` is consumed percent for the weekly window, normally 7 days (`604800` seconds).
- Remaining percent is `100 - used_percent`, clamped to `0..100`.
- `additional_rate_limits` may contain separate buckets such as Spark. The first version must parse Spark and show both Codex and Spark windows when available.

## Authentication

Read Codex OAuth credentials from file-based Codex auth locations:

1. `CODEX_HOME/auth.json`, when `CODEX_HOME` is set.
2. `~/.config/codex/auth.json`.
3. `~/.codex/auth.json`.

Expected auth shape:

```json
{
  "tokens": {
    "access_token": "<jwt>",
    "refresh_token": "<refresh>",
    "id_token": "<jwt>",
    "account_id": "<uuid>"
  },
  "last_refresh": "2026-01-28T08:05:37Z"
}
```

If no file auth exists, show unavailable limit text instead of failing startup. Keyring support is out of scope for the first version.

If the usage request returns `401` and a refresh token exists, refresh once:

```http
POST https://auth.openai.com/oauth/token
Content-Type: application/x-www-form-urlencoded

client_id=app_EMoamEEZ73f0CkXaXp7hrann
grant_type=refresh_token
refresh_token=<refresh_token>
```

Then retry `/wham/usage` once. Persist refreshed tokens back to the same auth file only if the existing auth file was readable and writable.

## UI Formatting

### Percent

- Convert `used_percent` to remaining percent: `Math.round(100 - used_percent)`.
- Clamp to `0..100`.
- Missing data renders as `--%`.

### Bar

Use 10 cells:

```text
[#######---]
```

Rules:

- Filled cells: `Math.round(remainingPercent / 10)`.
- Empty cells: `10 - filled`.
- Filled char: `#`.
- Empty char: `-`.
- Missing data: `[----------]`.

### Full Limits Row

```text
Codex 5H [#######---] 90% | Codex S [#########-] 92% | Spark 5H [#####-----] 50% | Spark S [########--] 80%
```

Use muted/dim theme color for normal text. Use warning/error colors only if theme-safe helpers already used elsewhere are easy to reuse in implementation; otherwise keep formatting plain to avoid theme regressions.

### Narrow Width Behavior

Render the full row when it fits. If terminal width is too narrow, use compact labels:

```text
C 5H [#######---] 90% | C S [#########-] 92% | SP 5H [#####-----] 50% | SP S [########--] 80%
```

If the compact row still does not fit, truncate to available width with an ellipsis.

## Refresh Behavior

The extension must not fetch on every render.

- Fetch once on `session_start` when UI is available.
- Refresh on a timer, default every 120 seconds.
- Refresh on `model_select` as a best-effort update.
- Clear timers on `session_shutdown`.
- On fetch errors, keep the last successful snapshot and mark it stale internally.
- If no successful snapshot exists, render unavailable text.

## Integration With Existing Minimal Row

Current minimal row already renders:

- folder on the left,
- mode centered,
- title/status on the right.

Do not create a separate footer/status entry for limits. Instead, expose a small shared state/event from `limit.ts`, then have `minimal.ts` render a new context row under the existing folder/mode/title row.

Proposed integration contract:

- `extensions/limit.ts` emits `orgm:limits-changed` with structured Codex and Spark window data plus preformatted full/compact display strings.
- `extensions/minimal.ts` listens for this event and stores the latest limit display model.
- `extensions/lib/minimal-title.ts` keeps the existing folder/mode/title row intact and adds a helper for rendering/truncating the limits row.

This keeps `limit.ts` responsible for data/auth/fetch/formatting and keeps `minimal.ts` responsible for layout.

## Extension Gating

Add `limit` to ORGM extension config known extensions so users can control it with:

```text
/orgm-extension limit on
/orgm-extension limit off
/orgm-extension limit status
```

Default enabled: `true`, following most existing extensions.

## Error Handling

- No auth file: no throw; display unavailable limits.
- Invalid auth JSON: no throw; display unavailable limits and optional warning only once per session.
- Network failure: keep last snapshot if available; otherwise unavailable.
- 401 refresh failure: unavailable, no repeated refresh loop.
- Unexpected payload shape: unavailable for missing windows, continue using any valid window present.
- Never print access tokens, refresh tokens, or raw auth files in UI, logs, tests, or tool results.

## Tests

Add focused unit tests for:

1. `used_percent` to remaining percent conversion and clamping.
2. Bar formatting at `100`, `92`, `90`, `0`, missing.
3. Parsing `/wham/usage` primary/secondary windows.
4. Parsing `additional_rate_limits` without breaking the default bucket.
5. Auth file lookup order with temp directories.
6. Minimal title row preserves folder/mode/title behavior unchanged.
7. New minimal limits row renders full labels when wide and compact/truncated output when narrow.
8. Extension gating recognizes `limit` in completions/status.

## Out of Scope For First Version

- Keyring auth lookup.
- Full settings UI for refresh intervals.
- Blocking model requests when limits reach 0.
- Historical usage graphing.

## Sources Checked

- OpenAI Codex official client: `codex-rs/backend-client/src/client.rs` uses `GET /wham/usage` and maps `rate_limit` plus `additional_rate_limits`.
- OpenAI Codex rate-limit parser: `codex-rs/codex-api/src/rate_limits.rs` parses primary/secondary windows and multiple limit families.
- Agentbar Codex usage provider: `https://cdn.jsdelivr.net/npm/agentbar@0.1.0/src/providers/codex/usage.ts`.
- OpenUsage Codex provider docs: `docs/providers/codex.md`, documenting the same endpoint and auth shape.
