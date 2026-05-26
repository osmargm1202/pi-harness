# pi-harness

Public Pi harness package containing extensions, agents/subagents, prompts, themes, assets, helper libraries, and widget-related harness pieces used by osmargm1202.

## Contents

- `extensions/` — Pi extensions, including subagents, agent status, awareness, orgm, caveman, and available footer/widget-related extensions.
- `agents/` — agent and subagent definitions, including team configuration.
- `prompts/` — reusable prompt templates.
- `themes/` — Pi theme JSON files.
- `assets/` — support assets and chain definitions.
- `lib/` — shared helper libraries for extensions.

## Install

Review the repository contents before installing. Pi packages can install executable extensions and prompt/agent configuration, so only install code you trust.

```bash
pi install git:github.com/osmargm1202/pi-harness
```

If this repository is later published to npm as `@osmargm1202/pi-harness`, install it with:

```bash
pi install npm:@osmargm1202/pi-harness
```

Pi package discovery loads the package `extensions/`, `prompts`, and `themes` through `package.json`. The `agents/`, `assets/`, and `lib/` directories are included so the harness extensions can reference the same organized stack; agent discovery behavior is implemented by the included extensions.

## Security note

This package is intended to be public, but it should still be reviewed before publication or installation to ensure it contains no secrets, local-only credentials, private host paths that should not be shared, or unsafe extension behavior.

## full-subagents

`extensions/full-subagents.ts` starts a configurable team of persistent headless Pi subagents and gives the parent agent tools for strict delegation.

Minimal `~/.pi/agent/orgm.json` slice:

```json
{
  "fullSubagents": {
    "enabled": true,
    "strictDelegation": true,
    "startupTeam": "tdd-core",
    "maxAgents": 5
  }
}
```

When enabled, the parent TUI shows a `Full subagents` widget. Busy or compacting agents are highlighted, idle agents are muted/healthy, and dead or errored agents are marked as down.

Parent-facing tools:

- `full_subagent_task` — assign a task to one configured subagent.
- `full_query_team` — assign work to a configured team in parallel or serial.

Commands:

- `/full-subagents` — show configured pool status.
- `/full-subagents restart <agent>` — accepted command shape for restarting an agent.
- `/full-subagents team <name>` — accepted command shape for switching teams.
