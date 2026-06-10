# Proposal: pi-caveman-package

## Intent

Move caveman runtime behavior out of `pi-harness` and into a dedicated Pi-native fork at `osmargm1202/pi-caveman`, installable with:

```text
pi install git:github.com/osmargm1202/pi-caveman
```

`pi-caveman` becomes the runtime source of truth for caveman state, prompt behavior, commands, configuration, and persistence. `pi-harness` keeps only optional, passive UI observation in the minimal footer through shared session entry and event names.

## Scope

### In scope

- Fork `JuliusBrussee/caveman` into `osmargm1202/pi-caveman` as a full Pi-native package.
- Preserve upstream-style command UX in `pi-caveman`:
  - `/caveman`
  - `/caveman-commit`
  - `/caveman-review`
  - `/caveman-compress`
  - `/caveman-stats`
- Make caveman auto-enable for every Pi session by default.
- Support configurable caveman level, with default level `full`.
- Remove hardcoded caveman runtime integration from `pi-harness`, including:
  - `extensions/caveman.ts`
  - `skills/caveman/SKILL.md`
  - caveman state helper usage that makes harness own runtime truth
- Adapt `extensions/minimal.ts` so minimal footer can optionally observe caveman status only through agreed shared session entry and event names emitted by `pi-caveman`.
- Remove caveman display/control from `extensions/agent-status.ts`.
- Update harness package metadata/docs/tests as needed so harness no longer ships or owns caveman runtime behavior.

### Out of scope

- Re-implementing caveman runtime logic inside `pi-harness`.
- Keeping `pi-harness` command aliases such as `/orgm-caveman` as active caveman controls.
- Shipping caveman prompt rules as `skills/caveman/SKILL.md` from `pi-harness`.
- Making `agent-status` observe or display caveman state after extraction.
- Changing unrelated mode, subagent, title, token, limit, or minimal-skill behavior.
- Proving upstream fork release/publish automation beyond Git installability.

## Affected Areas

- `pi-caveman` repository/package:
  - Pi package metadata
  - extension command registration
  - session start behavior
  - persistent config/state model
  - shared event and session entry contract
  - command behavior and tests
- `pi-harness` repository/package:
  - `extensions/caveman.ts` removal
  - `extensions/lib/caveman-state.ts` removal or reduction to shared observer constants/types only, if still needed by minimal footer
  - `extensions/minimal.ts` passive state observation
  - `extensions/agent-status.ts` caveman removal
  - `skills/caveman/SKILL.md` removal
  - `package.json` `files` / `pi.skills` exposure if caveman skill removal changes shipped content
  - README/docs references to bundled caveman behavior
  - tests covering caveman, minimal footer, and agent-status widget behavior

## Risks

- Exploration context is provided only through approved approach summary; no separate exploration artifact was present in `openspec/changes`.
- Shared event/session entry names must remain stable between `pi-caveman` and harness minimal footer, or footer state becomes stale/missing.
- Auto-on default may surprise users who install `pi-caveman` expecting opt-in behavior; config and command UX must make disabling clear.
- Removing `skills/caveman/SKILL.md` can break any user workflow that depended on loading caveman as a normal skill instead of runtime extension behavior.
- Existing tests may assume `pi-harness` owns caveman state/config; they need migration or deletion without hiding coverage gaps.
- Git installability depends on `pi-caveman` package shape matching Pi package discovery expectations.

## Rollback

- Reinstall or restore current `pi-harness` caveman files from prior commit:
  - `extensions/caveman.ts`
  - `extensions/lib/caveman-state.ts`
  - `skills/caveman/SKILL.md`
  - affected minimal/agent-status integrations
- Disable or uninstall `pi-caveman` if extracted runtime behavior causes session-start regressions.
- Revert `pi-harness` README/package/test changes tied to extraction.
- Because runtime truth moves to separate package, rollback should happen package-by-package: first disable `pi-caveman`, then restore harness integration only if needed.

## Success Criteria

- `pi install git:github.com/osmargm1202/pi-caveman` installs usable Pi-native caveman package.
- New Pi sessions with `pi-caveman` installed start in caveman mode by default at level `full`, unless config says otherwise.
- `/caveman`, `/caveman-commit`, `/caveman-review`, `/caveman-compress`, and `/caveman-stats` remain available from `pi-caveman`.
- `pi-harness` no longer ships `extensions/caveman.ts` or `skills/caveman/SKILL.md` as caveman runtime sources.
- `pi-harness` does not inject caveman prompt behavior or persist caveman config itself.
- `extensions/minimal.ts` can show caveman status only when `pi-caveman` emits recognized shared state; absence of `pi-caveman` is silent/non-fatal.
- `extensions/agent-status.ts` no longer imports, renders, or configures caveman state.
- Relevant tests/docs reflect ownership split: runtime behavior in `pi-caveman`; optional footer observation in `pi-harness`.
