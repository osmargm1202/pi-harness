# pi-harness Bundle Split Design

Date: 2026-06-11

## Goal

Split remaining feature/resource ownership out of `pi-harness`, then convert `pi-harness` into the ORGM bundle/meta-package so users can install one package and receive the full ORGM Pi stack.

## Approved phases

### Phase A: static/resource-heavy packages

Create and extract:

- `pi-themes`
- `pi-subagents`

`pi-themes` owns theme JSON files currently under `themes/`:

- `themes/catppuccin-mocha.json`
- `themes/cyberpunk.json`
- `themes/dracula.json`
- `themes/everforest.json`
- `themes/gruvbox.json`
- `themes/midnight-ocean.json`
- `themes/nord.json`
- `themes/ocean-breeze.json`
- `themes/orgm.json`
- `themes/orgm-light.json`
- `themes/rose-pine.json`
- `themes/synthwave.json`
- `themes/tokyo-night.json`

`pi-subagents` owns subagent prompts and subagent runtime behavior currently represented by:

- `agents/`
- `archive/subagents/`
- `extensions/subagents.ts`
- `extensions/lib/agent-discovery.ts`
- `extensions/lib/package-paths.ts`
- `extensions/lib/subagent-interaction-bridge.ts`
- `extensions/lib/subagent-runtime-model.ts`
- related subagent tests

### Phase B: focused command/runtime packages

Create and extract:

- `pi-awareness`
- `pi-notify`
- `pi-session`
- `pi-clear`

Source ownership:

- `pi-awareness` owns `extensions/awareness.ts` and `tests/awareness.test.ts`.
- `pi-notify` owns `extensions/notify.ts` and `tests/notify.test.ts`.
- `pi-session` owns `extensions/sessions.ts` and session-related tests added during extraction.
- `pi-clear` owns `extensions/clear.ts` and clear-related tests added during extraction.

### Phase C: `pi-harness` as ORGM bundle/meta-package

After extracted packages pass tests and install smoke, convert `pi-harness` into a bundle package.

Target responsibility:

- Install one ORGM package.
- Pin compatible package versions.
- Load subpackage resources through `node_modules/...` manifest paths.
- Keep migration docs and compatibility shims only when needed.

Target `package.json` pattern:

```json
{
  "name": "@osmargm1202/pi-harness",
  "dependencies": {
    "pi-mem": "github:osmargm1202/pi-mem",
    "pi-caveman": "github:osmargm1202/pi-caveman",
    "pi-footer": "github:osmargm1202/pi-footer",
    "pi-themes": "github:osmargm1202/pi-themes",
    "pi-subagents": "github:osmargm1202/pi-subagents",
    "pi-awareness": "github:osmargm1202/pi-awareness",
    "pi-notify": "github:osmargm1202/pi-notify",
    "pi-session": "github:osmargm1202/pi-session",
    "pi-clear": "github:osmargm1202/pi-clear",
    "pi-title": "github:osmargm1202/pi-title",
    "pi-ask": "github:osmargm1202/pi-ask",
    "pi-todo": "github:osmargm1202/pi-todo",
    "pi-banner": "github:osmargm1202/pi-banner"
  },
  "pi": {
    "extensions": [
      "node_modules/pi-caveman/extensions",
      "node_modules/pi-footer/extensions",
      "node_modules/pi-subagents/extensions",
      "node_modules/pi-awareness/extensions",
      "node_modules/pi-notify/extensions",
      "node_modules/pi-session/extensions",
      "node_modules/pi-clear/extensions",
      "node_modules/pi-title/extensions",
      "node_modules/pi-ask/extensions",
      "node_modules/pi-todo/extensions",
      "node_modules/pi-banner/extensions"
    ],
    "themes": ["node_modules/pi-themes/themes"],
    "prompts": ["node_modules/pi-subagents/prompts"]
  }
}
```

For npm distribution, `pi-harness` should add `bundledDependencies` for ORGM packages so the tarball contains subpackage resources. For GitHub install, Pi runs `npm install`, so GitHub dependencies are installed into `node_modules`.

## Safety rules

- Do not remove feature code from `pi-harness` until the replacement package has tests, pack check, and install smoke.
- Do not let `pi-banner` or `pi-harness` own footer/editor rendering. That stays in `pi-footer`.
- Do not let `pi-footer` generate titles. Title generation/state stays in `pi-title`.
- Keep one release-cycle compatibility shims where removing commands would break existing users.
- Prefer one package extraction per commit series.

## Verification per extracted package

Each package must pass:

```bash
npm test
npm run pack:check
pi install git:github.com/osmargm1202/<package>
```

`pi-harness` bundle must additionally pass:

```bash
pi install git:github.com/osmargm1202/pi-harness
pi list
PI_OFFLINE=1 pi --no-extensions -e /path/to/package-or-installed-harness --list-models
```

## Outcome

Final user path:

```bash
pi install git:github.com/osmargm1202/pi-harness
```

Advanced/selective path remains possible:

```bash
pi install git:github.com/osmargm1202/pi-footer
pi install git:github.com/osmargm1202/pi-themes
pi install git:github.com/osmargm1202/pi-subagents
```

`pi-harness` remains useful as the ORGM distro/meta-package. It should only be deleted if Pi package dependency loading from `node_modules` proves unreliable for GitHub installs and npm bundled installs.
