# Minimal Title Context Row Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the minimal footer title status into a consistent second row with folder on the left, current mode centered, and title/status on the right.

**Architecture:** Keep footer rendering in `extensions/minimal.ts` and title text formatting in `extensions/lib/minimal-title.ts`. Add a pure layout helper that accepts left/center/right text and truncates edges so the mode remains visible under narrow widths.

**Tech Stack:** TypeScript extension code, Node `assert` tests run with `node --experimental-strip-types`.

---

### Task 1: Add tripartite title row helper

**Files:**
- Modify: `extensions/lib/minimal-title.ts`
- Test: `tests/title.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests that call `renderTitleContextLine(...)` with ready/generating/error states and narrow widths:

```ts
const contextualReady = renderTitleContextLine(
	{ state: "ready", title: "Mi sesión larga" },
	40,
	" pi-harness",
	"PLAN",
	(kind, text) => text,
);
assert.equal(contextualReady.length, 40);
assert(contextualReady.includes(" pi-harness"));
assert(contextualReady.includes("PLAN"));
assert(contextualReady.includes("Mi sesión larga"));

const contextualNarrow = renderTitleContextLine(
	{ state: "ready", title: "Título muy largo" },
	18,
	" pi-harness",
	"PLAN",
	(kind, text) => text,
);
assert.equal(contextualNarrow.length, 18);
assert(contextualNarrow.includes("PLAN"));

const contextualGenerating = renderTitleContextLine(
	{ state: "generating", frame: "⠋" },
	32,
	" app",
	"BUILD",
	(kind, text) => text,
);
assert(contextualGenerating.includes("⠋ Generando título"));
assert(contextualGenerating.includes("BUILD"));

const contextualError = renderTitleContextLine(
	{ state: "error", error: "boom" },
	28,
	" app",
	"PLAN",
	(kind, text) => text,
);
assert(contextualError.includes("/orgm-title regen"));
```

- [ ] **Step 2: Run test to verify red**

Run: `node --experimental-strip-types tests/title.test.ts`
Expected: FAIL because `renderTitleContextLine` is not exported.

- [ ] **Step 3: Implement minimal helper**

Add helper in `extensions/lib/minimal-title.ts`:
- `formatTitleStatusText(status)` for ready/generating/error/idled title text.
- `renderTitleContextLine(status, width, leftText, centerText, style)` that pads to width, centers mode, right-aligns title, and truncates title/folder as needed.

- [ ] **Step 4: Run test to verify green**

Run: `node --experimental-strip-types tests/title.test.ts`
Expected: PASS.

### Task 2: Wire helper into minimal footer

**Files:**
- Modify: `extensions/minimal.ts`
- Test: `tests/title.test.ts`, full `tests/*.test.ts`

- [ ] **Step 1: Replace second-line renderer**

In `extensions/minimal.ts`, import `renderTitleContextLine` instead of `renderTitleLine` and render second line with `folderLabel`, `modeLabel`, `titleStatus`, and `width`.

- [ ] **Step 2: Run focused and full tests**

Run: `node --experimental-strip-types tests/title.test.ts`
Expected: PASS.

Run: `for f in tests/*.test.ts; do node --experimental-strip-types "$f"; done`
Expected: PASS, with only existing typeless package warnings.

### Self-review

- Spec coverage: folder left, mode center, title/status right, narrow width truncation covered.
- Placeholder scan: no TBD/TODO placeholders.
- Type consistency: `renderTitleContextLine` signature matches import and tests.
