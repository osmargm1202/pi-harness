# pi-harness

ORGM Pi bundle/meta-package. Install this one package to load the full ORGM Pi stack.

## What this is now

`pi-harness` is no longer the owner of large features. It is the ORGM distro package. It does not ship runtime extensions directly:

- pins compatible ORGM packages as dependencies
- loads their Pi resources from `node_modules/...`
- leaves command/workflow prompts to focused packages
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
pi install npm:pi-lens
pi install npm:pi-subagents-j0k3r
```

## Bundled packages

`pi-harness` depends on and loads:

- `pi-caveman`: caveman runtime and shared state events.
- `pi-footer`: Zentui-based editor/footer UI, ORGM title/caveman display, timer, and skill hook status.
- `pi-themes`: ORGM themes.
- `pi-subagents-j0k3r`: subagent orchestration and task delegation.
- `pi-mcp-adapter`: MCP integration and MCP tool surfacing.
- `pi-intercom`: session-to-session delegation coordination.
- `gentle-engram`: persistent memory and compaction state.
- `pi-web-access`: web search and URL fetch workflows.
- `pi-lens`: LSP feedback, diagnostics, and code analysis tooling.
- `pi-notify`: desktop/system notification behavior.
- `pi-init`: `/orgm-init` project context generation and `/orgm-config-init` config initialization.
- `pi-clear`: clear/reset helper commands.
- `pi-limit`: `/orgm-limits` command and limit reporting helpers.
- `pi-title`: title state/generation package and `/orgm-title`.
- `@juicesharp/rpiv-ask-user-question`: structured clarifying-question tool.
- `@juicesharp/rpiv-todo`: `/todos` command and `todo` tool.
- `pi-banner`: ORGM header/control plane (`/orgm-*`) and banner scaffold package.
- `pi-rename`: `/orgm-rename` command and rename helper workflows.

## Local resources kept here

- `docs/`: design, split, and migration notes.

Runtime resources should live in focused packages.

## Package boundaries

`pi-harness` does not own:

- editor/footer rendering, timer status, and skill status hooks → `pi-footer`
- themes → `pi-themes`
- subagents and delegated workstreams → `pi-subagents-j0k3r`
- MCP plumbing → `pi-mcp-adapter`
- inter-session coordination → `pi-intercom`
- persistent memory → `gentle-engram`
- web search/fetch runtime → `pi-web-access`
- diagnostics and quality gates → `pi-lens`
- notifications → `pi-notify`
- init → `pi-init`
- clear helpers → `pi-clear`
- titles → `pi-title`
- clarifying questions → `@juicesharp/rpiv-ask-user-question`
- TODOs → `@juicesharp/rpiv-todo`
- ORGM header/control plane and future banner/header work → `pi-banner`
- caveman runtime → `pi-caveman`
- limits → `pi-limit`
- rename helpers → `pi-rename`

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
