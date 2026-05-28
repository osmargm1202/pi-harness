# ORGM Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add complete `themes/orgm.json` Pi theme from approved ORGM header palette, without touching user settings.

**Architecture:** Single JSON theme file using ORGM header blues as shared vars, plus concise spec/plan docs for traceability. Validation uses one small script to confirm JSON parses and all required color tokens exist.

**Tech Stack:** JSON theme file, Markdown docs, Node.js validation script

---

### Task 1: Add ORGM theme file

**Files:**
- Create: `themes/orgm.json`

- [ ] Define reusable ORGM blues and dark surface vars.
- [ ] Map all 51 Pi theme tokens to readable dark-theme values.
- [ ] Add optional `export` colors aligned with theme surfaces.

### Task 2: Record approved design

**Files:**
- Create: `docs/superpowers/specs/2026-05-28-orgm-theme-design.md`
- Create: `docs/superpowers/plans/2026-05-28-orgm-theme.md`

- [ ] Save concise design summary with palette source and Pi token mapping.
- [ ] Save concise implementation plan for audit trail.

### Task 3: Validate completeness

**Files:**
- Verify: `themes/orgm.json`

- [ ] Run Node validation script to parse JSON.
- [ ] Compare `colors` keys against required 51-token list.
- [ ] Report verification output in handoff.
