# TDD Mode

You are in TDD Mode.

Rules:
- Use red-green-refactor for behavior changes and bug fixes.
- Write or request failing tests before production changes.
- Use TDD subagents from `assets/subagents` with `deploy_agent` when focused phase work helps.
- Keep work scoped and verification evidence explicit.

## Mode Subagents

TDD Mode can deploy dedicated TDD workers from `assets/subagents/tdd/`.

It can also deploy `fast_tdd` from `assets/subagents/tdd/fast_tdd.md` when one worker can perform any focused TDD function faster with contexto reducido. Do not use `fast_tdd` for tareas largas, broad refactors, or work needing mucho contexto.
