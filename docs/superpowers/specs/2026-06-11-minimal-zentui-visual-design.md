# Minimal Zentui Visual Design

## Goal

Make `extensions/minimal.ts` adopt the full visual feel of `pi-zentui`: an Opencode-style editor frame plus a Starship-inspired footer/statusline, while preserving the behavior that already exists in `minimal.ts`.

## Non-goals

- Do not add `font.ts`.
- Do not make Pi manage terminal fonts. Nerd Font remains a terminal/kitty setup concern.
- Do not depend on the installed `pi-zentui` package at runtime.
- Do not keep ChatGPT/Codex limit data in the persistent footer.

## Source Inspiration

Use installed package `pi-zentui` only as implementation reference:

- `extensions/zentui/ui.ts` for editor chrome.
- `extensions/zentui/footer.ts` for Starship-style line composition.
- `extensions/zentui/git.ts` for git branch/status parsing.
- `extensions/zentui/runtime.ts` for runtime/version detection.
- `extensions/zentui/format.ts` for context/token/cost labels.
- `extensions/zentui/user-message.ts` only if user-message chrome is needed later; not required for first implementation unless editor parity needs it.

## Visual Layout

Target layout:

```text
╭──────────────────────── model · provider · thinking ─╮
│ prompt                                                │
╰───────────────────────────────────────────────────────╯
󰝰 pi-harness on  main [!?] via  v22.22.1 · mcp …    42%/200k ↑1.2k ↓800 $0.003
title · ⏱ 12s · caveman full
```

The first visible area is the custom editor. Model, provider, and thinking level live inside the editor border, not in the footer.

The footer/status area has two responsibilities:

1. Starship line: project and runtime facts plus usage totals.
2. Minimal-extra line: existing `minimal.ts` state that is not part of Starship.

## Starship Line

Render one compact line with:

- Current directory basename with Nerd Font directory icon.
- Git branch with git icon when inside a repo.
- Git status indicators in compact bracket form:
  - `!` modified
  - `?` untracked
  - `+` staged
  - `✘` deleted
  - `»` renamed
  - `=` conflicted
  - `$` stashed
  - `↑` ahead
  - `↓` behind
  - `⇕` diverged
- Runtime/version segment using `via <runtime icon> <version>`.
- Extension statuses from `footerData.getExtensionStatuses()` when available, excluding hidden/internal statuses we own.
- Context percent/window label.
- Token totals.
- Cost.

Line must truncate safely to terminal width and never exceed `render(width)`.

## Minimal-extra Line

Render a second line below the Starship line with existing minimal state:

- Session title status.
- Prompt execution timer.
- Caveman state.
- Optional skills rows, if `orgm-minimal-skills` is enabled and skills are tracked.

This line replaces the old mixed footer arrangement where context/model/thinking/timer/caveman/tokens/cost all lived together.

## ChatGPT/Codex Limits

Limits are command-only.

- `/orgm-limits` fetches and renders the latest limit data.
- No automatic refresh on `session_start`.
- No periodic timer.
- No persistent `LIMITS_EVENT` line in `minimal.ts`.
- No `ctx.ui.setStatus("orgm-limit", ...)` footer/status entry.
- Command result appears as an inline custom message above the editor, in the same area where command/tool output appears.

Expected inline format:

```text
ChatGPT limits · 5h [####------]42% · week [##--------]18% · repo 10:32
```

Implementation shape:

- `limit.ts` registers a message renderer for custom type `orgm-limits`.
- `/orgm-limits` calls refresh once, then sends a display message with compact rows.
- Missing auth and fetch failure also render inline, not as persistent footer content.
- Notifications may be kept only for transient command errors if inline rendering is impossible.

## Proposed File Structure

- `extensions/lib/starship.ts`
  - Git status parsing/adaptation.
  - Runtime detection/adaptation.
  - Starship segment formatting.
  - Width-safe line composition.

- `extensions/lib/zentui-editor.ts`
  - Custom editor wrapper based on Pi `CustomEditor`.
  - Model/provider/thinking metadata inside editor frame.
  - Preserve existing Pi keybindings and autocomplete behavior.

- `extensions/minimal.ts`
  - Installs editor wrapper.
  - Installs custom footer.
  - Owns timer, caveman, title, skills state.
  - Calls `starship.ts` to render primary status line.

- `extensions/limit.ts`
  - Command-only limit fetch/render.
  - Inline custom message renderer.

## Error Handling

- Git status errors render no git segment.
- Runtime detection errors render no runtime segment.
- Unsupported model/provider limits render inline unsupported message only when `/orgm-limits` is run.
- Missing auth renders inline missing-auth message only when `/orgm-limits` is run.
- Editor installation should fall back to default editor if custom editor wrapping fails.

## Testing

Add/adjust tests before implementation:

- Starship git porcelain parsing.
- Starship line composition and truncation.
- Runtime detection for Node project (`package.json`).
- `minimal.ts` no longer imports/renders `renderLimitsContextLine` or `LIMITS_EVENT` in footer.
- `/orgm-limits` command sends inline custom message.
- Limit extension does not start timer or refresh automatically at session start.
- Existing minimal title/timer/caveman formatting remains covered.

## Acceptance Criteria

- `minimal.ts` visually matches Zentui structure: Opencode-style editor plus Starship footer.
- Model/provider/thinking appear in editor frame.
- Footer Starship line includes cwd, git branch/status, runtime/version, statuses, context, tokens, and cost.
- Existing title, timer, caveman remain visible on a separate minimal-extra line.
- ChatGPT/Codex limits appear only after `/orgm-limits` and render inline above the editor/output area.
- No font extension exists.
- Tests pass for changed behavior.
