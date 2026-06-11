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