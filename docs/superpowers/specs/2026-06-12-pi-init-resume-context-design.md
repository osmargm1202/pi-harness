# pi-init / pi-resume Context Design

## Purpose

Replicate Claude Code's project bootstrap and resume behavior for Pi, using ORGM conventions and files:

- Claude Code `/init` generates a `CLAUDE.md` project guide by scanning the repository.
- Claude Code `/resume` / `--resume` lets work continue from prior sessions and session state.
- ORGM Pi will use:
  - `CONTEXT.md` for durable project understanding.
  - `AGENTS.md` for agent/runtime instructions.
  - `RESUME.md` for current handoff state.

The goal is to prevent agents from rediscovering the same repo facts, current phase, stack, ownership, and next steps every session.

## Ownership

### `pi-init`

Owns project initialization documentation.

Commands:

- `/orgm-init`
  - Scan the current repository.
  - Generate or update `CONTEXT.md` and `AGENTS.md`.
  - Preserve manual content where possible.
- `/orgm-config-init`
  - Preserve old behavior: materialize full `~/.pi/agent/orgm.json` defaults.

### `pi-resume`

Owns continuity handoff documentation.

Commands:

- `/orgm-resume`
  - Generate or update `RESUME.md` with current branch/session/project state.
  - This is not the session picker. It is a handoff file for the next Pi session.

If old session-picker behavior remains useful, it must move to a separate command such as `/orgm-session-resume`. It must not block `/orgm-resume` from becoming the handoff generator.

### `pi-harness`

Remains bundle-only. It loads `pi-init` and `pi-resume` through dependencies but owns no runtime implementation.

## Files

### `CONTEXT.md`

Durable project memory. Commit-friendly. Stable unless project architecture or workflow changes.

Required sections:

1. `# Project Context`
2. `## Overview`
   - What the project does.
   - Who/what it is for.
3. `## Current Stack`
   - Languages, package managers, frameworks, runtimes.
4. `## Repository Map`
   - Important directories and packages.
5. `## Architecture / Ownership`
   - Which package owns which behavior.
   - Important boundaries.
6. `## Commands`
   - Install, test, typecheck, build, smoke, deploy if detected.
7. `## Configuration and Data`
   - Config files, env files, generated files, local data.
8. `## Conventions`
   - Naming, command namespace (`/orgm-*`), testing expectations, style notes.
9. `## Current Roadmap / Phases`
   - Stable phase list, not ephemeral session notes.
10. `## Do Not Rediscover`
   - Facts that were already settled and should be trusted unless contradicted by files.

### `AGENTS.md`

Instructions for Pi/agent behavior inside the repo. Commit-friendly. This should stay actionable and concise.

Required sections:

1. `# Agent Instructions`
2. `## Project Rules`
   - Repo-specific rules and constraints.
3. `## Package Ownership`
   - Focused package boundaries.
4. `## Development Workflow`
   - TDD, verification, commit rules if detected or configured.
5. `## Verification Matrix`
   - What to run when changing each package or file type.
6. `## Safety Notes`
   - Destructive commands, generated files, local-only files, protected paths.
7. `## Context Files`
   - Explain that `CONTEXT.md` is stable context and `RESUME.md` is active handoff.

### `RESUME.md`

Ephemeral current-state handoff. Can be committed or ignored depending on project preference, but should be useful as a direct next-session starting point.

Required sections:

1. `# Resume Context`
2. `## Timestamp`
3. `## Current Branch and Commits`
4. `## Dirty Files`
5. `## Recent Decisions`
6. `## Completed Work`
7. `## In Progress`
8. `## Blockers`
9. `## Next Steps`
10. `## Verification Status`
11. `## Suggested First Prompt`

## Scanner Design

Both packages should use bounded, deterministic scanning.

Ignore by default:

- `.git/`
- `node_modules/`
- build outputs: `dist/`, `build/`, `.next/`, `coverage/`
- package tarballs and generated caches
- large binary assets

`/orgm-init` should inspect:

- `package.json`, lockfiles, workspace files
- `tsconfig*`, `biome*`, `eslint*`, `prettier*`
- `pyproject.toml`, `Cargo.toml`, `go.mod`, `deno.json`, etc. when present
- `README.md`, existing `CONTEXT.md`, existing `AGENTS.md`
- docs/specs/plans when present
- CI configs
- source tree shape and entrypoints
- tests and scripts
- current git branch, recent commits, and dirty state

`/orgm-resume` should inspect:

- current git branch
- recent commits
- dirty files and summaries
- existing `RESUME.md`
- existing `CONTEXT.md` and `AGENTS.md` headings
- recent docs/specs/plans
- package lock/head refs if this is an ORGM package bundle
- optional session manager state if available through Pi APIs

## Write Strategy

Use managed sections to avoid overwriting manual content.

Recommended markers:

```markdown
<!-- ORGM:BEGIN generated -->
...
<!-- ORGM:END generated -->
```

If a file does not exist, create the full file.

If a file exists and has ORGM markers, replace only managed section.

If a file exists without markers:

- preserve entire file;
- append a new generated section;
- notify user that manual review is recommended.

## Error Handling

- If scanning fails on a file, skip it and record warning in output.
- If output file cannot be written, notify with error and do not partially overwrite.
- If repo is huge, use bounded sampling and report skipped directories.
- If no git repo is present, still generate context based on files and mark git status unavailable.

## Testing

### `pi-init`

Tests:

- package shape exposes `/orgm-init` and `/orgm-config-init` only under `/orgm-*`.
- scanner ignores `node_modules` and generated outputs.
- creates `CONTEXT.md` and `AGENTS.md` for a fixture repo.
- updates marked sections without deleting manual content.
- old config init behavior still writes ORGM config defaults.

### `pi-resume`

Tests:

- package shape exposes `/orgm-resume` only under `/orgm-*`.
- creates `RESUME.md` for a fixture repo.
- includes branch, commits, dirty files, next steps, verification status.
- updates marked section without deleting manual content.
- handles no-git repos gracefully.

### Bundle

Tests:

- `pi-harness` depends on `pi-init` and `pi-resume`.
- installed bundle command audit has zero non-`/orgm-*` commands.
- smoke load succeeds with only `pi-harness` installed.

## Migration Notes

Current state before this design:

- `pi-init` exists but `/orgm-init` only initializes `orgm.json`.
- `pi-resume` exists but `/orgm-resume` is based on session picker behavior.
- This design intentionally redefines both packages.

Required migration:

1. Move current config init behavior in `pi-init` from `/orgm-init` to `/orgm-config-init`.
2. Implement new `/orgm-init` as context generator.
3. Replace `pi-resume` command behavior with handoff generation.
4. If session picker remains, rename it to `/orgm-session-resume`.
5. Refresh `pi-harness` locks and run final command namespace audit.

## Acceptance Criteria

- Running `/orgm-init` in a repo creates or updates `CONTEXT.md` and `AGENTS.md`.
- Running `/orgm-resume` creates or updates `RESUME.md`.
- Generated files are useful enough that a new Pi session can understand what the project is, current stack, current phase, and what to do next without re-explaining from scratch.
- Manual content outside managed sections survives updates.
- All commands across the installed ORGM bundle start with `/orgm-*`.
- `pi-harness` remains the only directly installed ORGM package needed by users.
