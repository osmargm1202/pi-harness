# pi-harness Bundle Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract `pi-themes`, `pi-subagents`, `pi-awareness`, `pi-notify`, `pi-session`, and `pi-clear`, then convert `pi-harness` into the ORGM bundle/meta-package.

**Architecture:** New packages own focused resources/commands copied from `pi-harness` with local tests and GitHub install smoke. `pi-harness` then loads package resources through `node_modules/...` paths and keeps only bundle docs/compat metadata. Source removal from `pi-harness` happens only after extracted package verification.

**Tech Stack:** Pi package manifests, TypeScript Pi extensions, Node/Bun tests, GitHub package dependencies.

---

## File map

- `/home/osmarg/Code/pi-themes`: new package, `themes/*.json`, README, package shape test.
- `/home/osmarg/Code/pi-subagents`: new package, `agents/`, `archive/subagents/`, `extensions/subagents.ts`, required `extensions/lib/*`, copied subagent tests.
- `/home/osmarg/Code/pi-awareness`: new package, `extensions/awareness.ts`, required config helper, copied awareness test.
- `/home/osmarg/Code/pi-notify`: new package, `extensions/notify.ts`, required config helper, copied notify test.
- `/home/osmarg/Code/pi-session`: new package, `extensions/sessions.ts`, required config/select helper, package shape test plus any extracted session tests.
- `/home/osmarg/Code/pi-clear`: new package, `extensions/clear.ts`, required config helper, package shape test.
- `/home/osmarg/Code/pi-harness/package.json`: convert to bundle dependencies and `node_modules/...` resource manifest.
- `/home/osmarg/Code/pi-harness/README.md`: document bundle install path.

## Task 1: Extract `pi-themes`

- [ ] Create `osmargm1202/pi-themes` if missing and clone to `/home/osmarg/Code/pi-themes`.
- [ ] Copy `themes/*.json` from `/home/osmarg/Code/pi-harness/themes/`.
- [ ] Create `package.json` with `pi.themes: ["./themes"]`.
- [ ] Create README with standalone install and bundle notes.
- [ ] Add `test/package-shape.test.mjs` checking `pi.themes` and theme file count.
- [ ] Run `npm test`, `npm run pack:check`, `pi install git:github.com/osmargm1202/pi-themes`.
- [ ] Commit and push.

## Task 2: Extract `pi-subagents`

- [ ] Create `osmargm1202/pi-subagents` if missing and clone to `/home/osmarg/Code/pi-subagents`.
- [ ] Copy `agents/`, `archive/subagents/`, `extensions/subagents.ts`, and required library files from `pi-harness`.
- [ ] Copy subagent tests from `pi-harness/tests/`.
- [ ] Create `package.json` with peer dependencies on Pi packages and `typebox`.
- [ ] Patch imports only if paths change.
- [ ] Run package tests, pack check, and install smoke.
- [ ] Commit and push.

## Task 3: Extract focused command packages

For each package:

- `pi-awareness`: copy `extensions/awareness.ts`, `extensions/lib/orgm-extension-config.ts`, `tests/awareness.test.ts`.
- `pi-notify`: copy `extensions/notify.ts`, `extensions/lib/orgm-extension-config.ts`, `tests/notify.test.ts`.
- `pi-session`: copy `extensions/sessions.ts`, `extensions/lib/tui-select-panel.ts`, `extensions/lib/orgm-extension-config.ts`, add package shape test.
- `pi-clear`: copy `extensions/clear.ts`, `extensions/lib/orgm-extension-config.ts`, add package shape test.

Steps per package:

- [ ] Create repo if missing and clone.
- [ ] Create `package.json` with `pi.extensions` pointing to the one extension file.
- [ ] Copy source/tests.
- [ ] Run `npm test`, `npm run pack:check`, `pi install git:github.com/osmargm1202/<package>`.
- [ ] Commit and push.

## Task 4: Convert `pi-harness` to ORGM bundle

- [ ] Update `package.json` dependencies to GitHub ORGM packages.
- [ ] Update `pi` manifest to load resources from `node_modules` package paths.
- [ ] Keep local compatibility files only if needed; remove local resources that are now owned by extracted packages after bundle smoke passes.
- [ ] Update README to explain one-command install and selective installs.
- [ ] Run `npm install --package-lock-only` or `npm install` as needed.
- [ ] Run bundle smoke: `pi install git:github.com/osmargm1202/pi-harness`, `pi list`, and a non-interactive load/list-model smoke.
- [ ] Commit and push.

## Verification gates

Do not claim complete unless:

- every new repo is pushed,
- every new repo passes tests + pack check,
- every new repo installs through `pi install git:github.com/osmargm1202/<repo>`,
- `pi-harness` bundle install works,
- final `git status --short --branch` is clean/synced for touched repos.
