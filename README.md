# pi-harness

ORGM Pi bundle/meta-package. Install this one package to load the full ORGM Pi stack.

## What this is now

`pi-harness` is no longer the owner of large features. It is the ORGM distro package:

- pins compatible ORGM packages as dependencies
- loads their Pi resources from `node_modules/...`
- keeps stack-level prompt templates in `prompts/`
- documents package boundaries and migration notes

## Install

One-command ORGM stack install:

```bash
pi install git:github.com/osmargm1202/pi-harness
```

Selective install remains possible for individual packages:

```bash
pi install git:github.com/osmargm1202/pi-footer
pi install git:github.com/osmargm1202/pi-themes
pi install git:github.com/osmargm1202/pi-subagents
```

## Bundled packages

`pi-harness` depends on and loads:

- `pi-mem`: local memory/context index provider.
- `pi-caveman`: caveman runtime and shared state events.
- `pi-footer`: Zentui-based editor/footer UI, ORGM title/caveman display, timer, and skill hook status.
- `pi-themes`: ORGM themes.
- `pi-subagents`: ORGM subagent prompts and deployment extension.
- `pi-awareness`: awareness banner/status behavior.
- `pi-notify`: desktop/system notification behavior.
- `pi-session`: session switching/listing helpers.
- `pi-clear`: clear/reset helper commands.
- `pi-limit`: `/orgm-limits` command and limit reporting helpers.
- `pi-title`: title state/generation package and `/orgm-title`.
- `pi-ask`: ask/wrap command package and `ask_user_question` tool.
- `pi-todo`: TODO command/state package and `todo` tool.
- `pi-banner`: ORGM agent-status banner/widget package.

## Local resources kept here

- `prompts/`: small stack-level prompt templates (`gcl`, `gis`, `gpr`, `gwr`).
- `docs/`: design, split, and migration notes.

Everything else should live in focused packages.

## Package boundaries

`pi-harness` does not own:

- editor/footer rendering, timer status, and skill status hooks → `pi-footer`
- themes → `pi-themes`
- subagents → `pi-subagents`
- awareness → `pi-awareness`
- notifications → `pi-notify`
- sessions → `pi-session`
- clear helpers → `pi-clear`
- titles → `pi-title`
- ask/wrap → `pi-ask`
- TODOs → `pi-todo`
- agent-status banner/widget → `pi-banner`
- memory → `pi-mem`
- caveman runtime → `pi-caveman`
- limits → `pi-limit`

## Development

```bash
npm install
npm run pack:check
```

Smoke bundle install:

```bash
pi install git:github.com/osmargm1202/pi-harness
pi list
```

## Security note

Pi packages run executable extension code. Review package sources before installing, especially this bundle because it installs multiple ORGM packages.
