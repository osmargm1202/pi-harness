# Package Agent Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `pi-harness` agents and teams work after `pi install git:github.com/osmargm1202/pi-harness` without extra user configuration.

**Architecture:** Extend the existing discovery helpers so package-bundled `agents/` is treated as a fallback user-scope source alongside `~/.pi/agent/agents`. Project `.pi/agents` keeps override precedence. Tests exercise real discovery functions against temporary user/project/package agent directories.

**Tech Stack:** TypeScript Pi extension code, Bun for test execution, Node `assert` and temporary filesystem fixtures.

---

### Task 1: Add package agent directory discovery

**Files:**
- Modify: `extensions/lib/agent-discovery.ts`
- Test: `tests/agent-discovery.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/agent-discovery.test.ts` with fixtures that prove package agents are discovered without copying to `~/.pi/agent/agents`, and project agents can override package agents.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd ~/Code/pi-harness
bun tests/agent-discovery.test.ts
```

Expected: FAIL because `discoverDeployableAgents()` does not yet include package-bundled agents.

- [ ] **Step 3: Implement minimal package discovery**

In `extensions/lib/agent-discovery.ts`, add exported helpers for package agent roots and let `discoverDeployableAgents()` / `discoverPrimaryAgents()` merge package agents as fallback user-scope items before project overrides.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd ~/Code/pi-harness
bun tests/agent-discovery.test.ts
```

Expected: PASS.

### Task 2: Add package teams discovery

**Files:**
- Modify: `extensions/subagents.ts`
- Test: `tests/subagents-team-discovery.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/subagents-team-discovery.test.ts` using exported team helpers to show package `agents/teams.yaml` is discovered and project `teams.yaml` overrides same-named package teams.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd ~/Code/pi-harness
bun tests/subagents-team-discovery.test.ts
```

Expected: FAIL because team discovery only checks `~/.pi/agent/agents/teams.yaml` and project `.pi/agents/teams.yaml`.

- [ ] **Step 3: Implement minimal teams discovery**

In `extensions/subagents.ts`, reuse the package agent root helper from `agent-discovery.ts`, load `agents/teams.yaml` from package roots, and merge package teams as fallback user-scope teams before project teams.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
cd ~/Code/pi-harness
bun tests/subagents-team-discovery.test.ts
```

Expected: PASS.

### Task 3: Verify installed-package behavior

**Files:**
- Modify only if tests reveal an issue.

- [ ] **Step 1: Run focused tests**

```bash
cd ~/Code/pi-harness
bun tests/agent-discovery.test.ts
bun tests/subagents-team-discovery.test.ts
```

Expected: both PASS.

- [ ] **Step 2: Run existing relevant tests**

```bash
cd ~/Code/pi-harness
bun tests/title.test.ts
bun tests/subagents-inline-render.test.ts
```

Expected: both PASS.

- [ ] **Step 3: Sync/update installed package checkout only after dev repo is correct**

Because Pi currently runs from `~/.pi/agent/git/github.com/osmargm1202/pi-harness`, verify the same commit/content is present there after the dev change is committed/pulled or copied by the user’s package update flow.

- [ ] **Step 4: Smoke test Pi tool discovery**

Run a Pi session or use the harness tool to verify `query_team(pi-orchestrator)` and `deploy_agent(skill-expert)` no longer report “Available teams: none” / “Available: none”.
