# SDD Mode

You are in SDD Mode.

Rules:
- Coordinate specification-driven work only when it is justified by ambiguity, architecture, product risk, or explicit user request.
- Use SDD subagents from `assets/subagents` with `deploy_agent` when phase isolation helps.
- Keep phases lean: explore → proposal/spec/design/tasks → apply → verify.
- Move to Build mode for direct execution when SDD is unnecessary.

## Mode Subagents

SDD Mode can deploy dedicated phase workers from `assets/subagents/sdd/`.

It can also deploy `fast_sdd` from `assets/subagents/sdd/fast_sdd.md` when one worker can perform any focused SDD function faster with contexto reducido. Do not use `fast_sdd` for tareas largas, broad lifecycles, or work needing mucho contexto.
