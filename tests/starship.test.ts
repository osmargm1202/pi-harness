import assert from "node:assert/strict";
import {
	buildStarshipLine,
	detectRuntimeFromEntries,
	formatGitStatusIndicators,
	parseGitStatusPorcelain,
	visibleWidth,
} from "../extensions/lib/starship.ts";

const porcelain = [
	"# branch.oid 123456",
	"# branch.head main",
	"# branch.upstream origin/main",
	"# branch.ab +2 -1",
	"1 M. N... 100644 100644 100644 a b file.ts",
	"1 .D N... 100644 100644 000000 a b deleted.ts",
	"1 A. N... 000000 100644 100644 a b added.ts",
	"2 R. N... 100644 100644 100644 a b R100 old.ts\tnew.ts",
	"? untracked.ts",
	"u UU N... 100644 100644 100644 100644 a b c conflict.ts",
].join("\n");

const status = parseGitStatusPorcelain(porcelain, true);
assert.equal(status.branch, "main", "branch should parse from porcelain v2 header");
assert.equal(status.ahead, 2, "ahead count should parse");
assert.equal(status.behind, 1, "behind count should parse");
assert.equal(status.modified, 1, "modified worktree count should parse");
assert.equal(status.deleted, 1, "deleted count should parse");
assert.equal(status.staged, 1, "staged count should parse");
assert.equal(status.renamed, 1, "renamed count should parse");
assert.equal(status.untracked, 1, "untracked count should parse");
assert.equal(status.conflicted, 1, "conflicted count should parse");
assert.equal(status.stashed, true, "stash flag should be preserved");
assert.equal(formatGitStatusIndicators(status), "[!?+✘»=$⇕]", "dirty status should render compact indicators with diverged arrow");

assert.equal(formatGitStatusIndicators({ ...status, ahead: 0, behind: 0 }), "[!?+✘»=$]", "non-diverged status should omit arrows when clean relative to remote");
assert.equal(formatGitStatusIndicators({ ...status, modified: 0, deleted: 0, staged: 0, renamed: 0, untracked: 0, conflicted: 0, stashed: false, ahead: 1, behind: 0 }), "[↑]", "ahead-only status should show up arrow");
assert.equal(formatGitStatusIndicators({ ...status, modified: 0, deleted: 0, staged: 0, renamed: 0, untracked: 0, conflicted: 0, stashed: false, ahead: 0, behind: 1 }), "[↓]", "behind-only status should show down arrow");
assert.equal(formatGitStatusIndicators({ ...status, modified: 0, deleted: 0, staged: 0, renamed: 0, untracked: 0, conflicted: 0, stashed: false, ahead: 0, behind: 0 }), "", "clean status should render no bracket");

const runtime = detectRuntimeFromEntries(["package.json", "README.md"], { nodeVersion: "v22.22.1" });
assert.deepEqual(runtime, { name: "node", symbol: "", version: "v22.22.1" }, "package.json should detect Node runtime");

const line = buildStarshipLine({
	cwd: "/home/osmarg/Code/pi-harness",
	git: status,
	runtime,
	extensionStatuses: new Map([["mcp", "mcp:2"], ["orgm-limit", "hidden"]]),
	contextLabel: "42%/200k",
	tokenLabel: "↑1.2k ↓800",
	costLabel: "$0.003",
	width: 120,
	style: (_kind, text) => text,
});
assert(line.includes("󰝰 pi-harness"), "line should include cwd segment");
assert(line.includes("on  main [!?+✘»=$⇕]"), "line should include git branch and indicators");
assert(line.includes("via  v22.22.1"), "line should include runtime segment");
assert(line.includes("mcp:2"), "line should include external statuses");
assert(!line.includes("orgm-limit"), "line should hide orgm-limit internal status");
assert(line.includes("42%/200k"), "line should include context label");
assert(line.includes("↑1.2k ↓800"), "line should include token label");
assert(line.includes("$0.003"), "line should include cost label");
assert(visibleWidth(line) <= 120, "wide line should fit width");

const narrow = buildStarshipLine({
	cwd: "/home/osmarg/Code/pi-harness",
	git: status,
	runtime,
	extensionStatuses: new Map([["mcp", "mcp:2"]]),
	contextLabel: "42%/200k",
	tokenLabel: "↑1.2k ↓800",
	costLabel: "$0.003",
	width: 36,
	style: (_kind, text) => text,
});
assert(visibleWidth(narrow) <= 36, "narrow line should fit width");
assert(narrow.endsWith("…") || visibleWidth(narrow) < 36, "narrow line should truncate gracefully");
