<claude-mem-context>
# Memory Context

# [pi-harness/simplify-harness] recent context, 2026-06-10 11:58pm UTC

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 6 obs (1,519t read) | 23,860t work | 94% savings

### Jun 9, 2026
49 11:22p 🔵 pi-harness Project Structure and Dependencies Identified
50 " 🔵 pi-harness Has No tsconfig.json — TypeScript Type Check Cannot Run
51 " 🔵 pi-harness Extensions Inventory: 15 TypeScript Extension Files
52 11:23p 🔵 Dev Dependencies Missing — Only Peer Deps Installed in node_modules
53 " 🔵 Recent Commits Touched limit and agent-discovery — Likely Related to Tool Breakage
54 " 🔵 pi CLI v0.79.1 Installed and Running; Matches Peer Dependency Version
S27 Investigate broken tools in pi-harness (pi-coding-agent extension) (Jun 9, 11:23 PM)
**Investigated**: - Project structure at /home/osmarg/Code/pi-harness
    - package.json (full contents, peer deps, pi manifest)
    - node_modules contents
    - extensions/ directory (15 .ts files + lib/ subdirectory)
    - extensions/lib/ (14 shared library files)
    - tests/ directory (30+ test files)
    - TypeScript compiler availability (tsc v6.0.3, no tsconfig.json)
    - vitest availability (not found anywhere in node_modules tree)
    - pi CLI installation and version
    - pi-coding-agent package.json scripts
    - README.md (architecture overview)
    - extensions/git.ts (sample extension structure)
    - git log (last 10 commits, diff of last 3)

**Learned**: - pi-harness is an extension package for pi-coding-agent v0.79.1; pi CLI is installed and running at that version
    - node_modules contains ONLY peer dependencies (@earendil-works/* + typebox) — no devDependencies at all
    - package.json has no "scripts" section and no tsconfig.json exists — dev toolchain is not configured
    - vitest is absent from entire node_modules tree; running tests is impossible locally
    - `pi test` does not run unit tests — it launches a pi agent session instead
    - Extensions are raw TypeScript source files consumed directly by the pi runtime
    - Last 3 commits changed: extensions/lib/agent-discovery.ts, extensions/lib/limit-usage.ts, extensions/limit.ts (MiniMax quota features + subagent scope fix)
    - pi-coding-agent uses `tsgo` (not standard tsc) for its own build
    - The "broken tools" complaint has no error message yet — investigator asked user for specific error/behavior

**Completed**: - Full project structure mapped
    - Dev environment gaps identified (no devDeps, no vitest, no tsconfig, no scripts)
    - Most recently changed files identified as primary suspects
    - pi CLI confirmed running at correct version

**Next Steps**: Waiting for user to provide specific error message or describe which tool/extension/command is broken. Without that, investigation is stalled. Once error is known, likely next steps are: inspect the specific failing extension file, check imports against what pi-coding-agent exports, and look at recent changes in agent-discovery.ts or limit-usage.ts for regressions.


Access 24k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>

<!-- ORGM:BEGIN generated -->
# Agent Instructions

## Project Rules

- Read `CONTEXT.md` first for durable project context.
- Read `RESUME.md` when continuing work from a handoff.
- Keep manual content outside ORGM generated markers intact.
- Current package: `@osmargm1202/pi-harness` at `/home/osmarg/Code/pi-harness`.
- Treat this repo as bundle/meta-package maintenance, not feature implementation.

## Package Ownership

`pi-harness` owns only:

- ORGM bundle dependency graph in `package.json` / `package-lock.json`.
- Pi manifest paths that load resources from `node_modules/pi-*` packages.
- Local stack-level prompts in `prompts/`.
- README/package-boundary documentation.

Do not implement feature/runtime behavior here. Route work to focused packages:

- UI/footer/status: `pi-footer`.
- Themes: `pi-themes`.
- Subagents/deploy/status widgets: `pi-subagents`.
- Header/control plane: `pi-banner`.
- Memory: `pi-mem`.
- Caveman runtime: `pi-caveman`.
- Init/resume context files: `pi-init`, `pi-resume`.
- Ask/todo tools: `pi-ask`, `pi-todo`.
- Limits/clear/notify/awareness/title: `pi-limit`, `pi-clear`, `pi-notify`, `pi-awareness`, `pi-title`.

## Development Workflow

- Use TDD for behavior changes. In this repo, that usually means shape tests around bundle manifest behavior.
- Prefer focused changes: update package manifest, lockfile, README, and tests together when bundle composition changes.
- Keep slash commands under `/orgm-*` across bundled packages.
- Do not add local `extensions/`, `agents/`, `themes/`, or runtime feature code to this repo unless explicitly reverting the bundle split.
- For broken bundled behavior, inspect the owning package first; only change `pi-harness` if the dependency/manifest/lock is wrong.

## Verification Matrix

For documentation-only changes:

- `npm run pack:check` — package dry run.

For bundle/manifest/dependency changes:

- `node --test tests/harness-bundle-only.test.mjs` — verifies bundle-only constraints.
- `npm run pack:check` — verifies package contents.
- `PI_OFFLINE=1 pi --no-extensions -e /home/osmarg/Code/pi-harness --list-models` — non-interactive load smoke when Pi is available.
- `pi install git:github.com/osmargm1202/pi-harness && pi list` — install smoke when changing published bundle composition.

Known command facts:

- `package.json` has no `npm test` script.
- `openspec/config.yaml` lists `bun test <test-file>` as focused runner, but current checked-in test uses Node `node:test` and runs with `node --test`.

## Safety Notes

- Do not edit ignored/generated directories: `node_modules/`, `.git/`, `.worktrees/`, `.superpowers/`, `.pi-cache/`, `dist/`, `build/`, `coverage/`.
- Ask before destructive changes or package-lock refreshes that pull many new GitHub refs.
- Do not stage unrelated local context files unless the user asked for context maintenance.
- Package tarball currently includes only `prompts/` and `README.md`; docs/tests/context files are repo metadata.
- Pi packages execute extension code. Keep README security note visible when changing install docs.

## Context Files

- `CONTEXT.md`: durable project overview, ownership, commands, constraints, and settled facts.
- `AGENTS.md`: concrete instructions for future Pi agents in this repo.
- `RESUME.md`: current handoff state when generated by `/orgm-resume`.
- `ORGMINIT_REVIEW_PROMPT.md`: generated prompt that asked for context review; do not treat as product docs.
<!-- ORGM:END generated -->
