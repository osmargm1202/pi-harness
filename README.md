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

`extensions/full-subagents.ts` configures and displays a startup team of headless Pi subagents and gives the parent agent tools for strict delegation. When enabled agents are configured, `session_start` creates a runtime pool and routes delegated tasks through child transports. Tests can inject a fake runtime factory so they do not spawn real Pi subprocesses.

Minimal `~/.pi/agent/orgm.json` slice:

```json
{
  "fullSubagents": {
    "enabled": true,
    "strictDelegation": true,
    "startupTeam": "tdd-core",
    "maxAgents": 5,
    "widgetLayout": "minimal",
    "agents": {
      "tdd-planner": { "model": "openai-codex/gpt-5.4", "tools": ["read", "bash"] },
      "tdd-verifier": { "model": "openai-codex/gpt-5.4" }
    }
  }
}
```

`fullSubagents.agents` is the highest-priority per-subagent override layer for the full-subagents runtime. On `session_start`, enabled agents must resolve to a backing `.md` agent document; missing docs block runtime creation and show an error. Configured agent overrides are also synced into `~/.pi/agent/agents/<namespace>/<agent>.md`, so local model/tool choices survive package git updates.

When `strictDelegation` is enabled, the parent agent is only an orchestrator/communicator: direct read, shell, edit, write, and context execution tools are blocked in the parent and meaningful work must be delegated to `full_subagent_task` or `full_query_team`.

When enabled, the parent TUI shows a `Full subagents` widget. Set `widgetLayout` to `minimal` for compact skill-like rows or `full` for per-agent cards. Busy or compacting agents are highlighted, idle/awaiting agents are muted, and dead or errored agents are marked as down.

Parent-facing tools:

- `full_subagent_task` — route a task through one configured subagent when a runtime pool is available; otherwise record it as queued without runtime.
- `full_query_team` — route work through a configured team in parallel or serial when a runtime pool is available; otherwise record it as queued without runtime.

Commands:

- `/orgm-full-subagents` — show configured pool status.
- `/orgm-full-subagents init` — create or merge a safe `fullSubagents` slice into `~/.pi/agent/orgm.json` with `enabled: false` and startup-team agent stubs so it can be edited before activation.
- `/orgm-full-subagents stop <agent|all>` — abort active work without destroying the runtime context.
- `/orgm-full-subagents continue <agent> <task>` — send a follow-up task to an existing runtime.
- `/orgm-full-subagents restart <agent>` — replace one subagent runtime with a fresh process.
- `/orgm-full-subagents reset all` — terminate the current pool and create a fresh pool.
- `/orgm-full-subagents team <name>` — accepted command shape and placeholder for upcoming team switch behavior; it does not actively switch teams yet.
