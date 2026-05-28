# ORGM Theme Design

## Goal
Create project theme `orgm` for Pi TUI using approved ORGM header gradient colors from `extensions/orgm.ts`, without changing user settings.

## Source palette
- Shadow gradient: `#031E5C`, `#0A4EB9`, `#3691FF`
- No-shadow gradient: `#084AAA`, `#1367DC`, `#529EFF`

## Design decisions
- Dark theme with deep navy backgrounds derived from ORGM shadow palette.
- Use brighter no-shadow blues for borders, links, labels, and active emphasis.
- Keep high-contrast near-white text for readability on dark surfaces.
- Keep success/error/warning distinct from blue accent family for fast state scanning.
- Add optional `export` colors so `/export` output stays aligned with ORGM dark surfaces.

## Pi mapping summary
- Accent: ORGM bright header blue.
- Borders: cobalt/bright blue hierarchy.
- Selected background: brighter blue panel.
- User/custom/tool boxes: layered navy panels with readable text.
- Markdown: blue headings/links, readable code/quotes.
- Diffs and syntax: non-blue status colors plus blue syntax family.
- Thinking borders: low-to-high intensity moves from muted navy to bright blue, with xhigh in error color.
- Bash mode: warning amber for strong mode contrast.

## Constraints
- Follow existing `themes/*.json` conventions.
- Define all 51 required theme tokens.
- Keep scope to new theme file and supporting docs only.
- Do not edit active user settings.
