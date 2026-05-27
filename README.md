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

Active full-subagents flow is disabled in this branch and moved to archive for future work.

Archived implementation (inactive): `archive/full-subagents/`.
- Source: `archive/full-subagents/extensions/`
- Tests: `archive/full-subagents/tests/`
- Plans/specs: `archive/full-subagents/docs/`

`fullSubagents` no longer exposes commands, tools, or strict delegation behavior.

`orgm.json` keys outside known orgm slices are preserved during load/save, so local or future orgm keys survive config migrations.
