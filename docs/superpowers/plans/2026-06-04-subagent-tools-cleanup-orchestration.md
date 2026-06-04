# Subagent tools, cleanup, and mode orchestration plan

## Goal

Make delegated agents receive the tools they declare, clean up child pi processes reliably, and make Plan/SDD/TDD mode prompts enforce their intended orchestration behavior.

## Plan

1. Add tests proving `deploy_agent` passes non-builtin tools like `ask_user_question` and `engram_mem_save` through `--tools`.
2. Add tests proving deployable subagent prompts expose `ask_user_question` plus existing Engram tools where needed.
3. Add tests proving subagent subprocess cleanup uses process-group/tree termination and lifecycle cleanup hooks.
4. Add tests proving SDD/TDD prompts are orchestration-first and Plan prompt requires a concrete plan before switching modes.
5. Implement minimal code/prompt changes to satisfy tests.
6. Run full `bun test`, commit, push `subagent-orchestrator-cleanup` to `main` if clean.
