import assert from "node:assert/strict";
import { visibleWidth } from "@earendil-works/pi-tui";
import { renderDocViewerRows } from "../extensions/spec-dis.ts";

const rows = renderDocViewerRows({
	innerWidth: 20,
	viewerBodyLines: 3,
	titleLine: "SPEC · Viewer width",
	metaLine: "05/27/2026 20:00 · docs/spec.md",
	scrollLine: "Lines 1-2 of 2 · offset 0",
	helpLine: "↑/↓ or j/k scroll • pageUp/pageDown jump • esc/q close",
	bodyLines: ["alpha", "beta"],
	scrollOffset: 0,
});

assert(rows.length >= 7, "viewer should include frame, metadata, body, and help rows");
assert(rows.every((row) => visibleWidth(row) === 22), "every rendered viewer row should have same visible width");
assert.equal(rows[4], "│ alpha              │", "body rows should keep one space of interior padding on both sides");
assert.equal(rows[5], "│ beta               │", "short body rows should pad to full framed width");
assert.equal(rows[6], "│                    │", "empty filler body rows should still preserve full width");
