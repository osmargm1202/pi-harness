import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
	materialPiMemContextIndexKey,
	normalizePiMemContextIndexEvent,
	renderPiMemContextIndexWidget,
} from "../extensions/lib/pi-mem-context-index.ts";

test("ORGM normalizes and renders pi-mem context-index bridge payloads", () => {
	const source = readFileSync(new URL("../extensions/orgm.ts", import.meta.url), "utf8");
	assert(source.includes("pi.events.on(PI_MEM_CONTEXT_INDEX_EVENT"), "ORGM front should listen for pi-mem context index bridge event");
	assert(source.includes("lines.push(...renderPiMemContextIndexWidget"), "ORGM front should render pi-mem context index inside the startup header");
	assert(!source.includes("[pi-mem-context-index]"), "ORGM front should not reintroduce prompt-visible pi-mem marker spam");

	const payload = normalizePiMemContextIndexEvent({
		content: `<pi-mem>
Legend
- [S] Session summary
Column Key
- Token: local access token for follow-up lookup
Context Index Instructions
Use this index as memory context.
Context Economics
Loading: 6 observations.
Observations by Date and File
2026-06-10
  pi-men
    [O] obs:1 | Important thing | useful memory | Why: project
Session Summaries
[S] session:abc | 2026-06-10 | pi-men
Overview: prior work
Access tokens: obs:1, session:abc
View Observations Live URL: http://127.0.0.1:37980
</pi-mem>`,
		viewerUrl: "http://127.0.0.1:37980",
		counts: { observations: 6, sessions: 1 },
		tokens: ["obs:1", "session:abc"],
		summary: "6 memories selected",
		project: "pi-men",
		sessionId: "abc",
		queryHash: "same-context",
		emittedAt: "2026-06-10T17:10:00.000Z",
	});

	assert(payload);
	assert.equal(payload.viewerUrl, "http://127.0.0.1:37980");
	assert.equal(payload.counts.observations, 6);
	assert.equal(materialPiMemContextIndexKey(payload), "same-context");

	const lines = renderPiMemContextIndexWidget(payload, 96);
	assert(lines.some((line) => line.includes("π pi-mem SessionStart")));
	assert(lines.some((line) => line.includes("Legend")));
	assert(lines.some((line) => line.includes("Context Index:")));
	assert(lines.some((line) => line.includes("Observations by Date and File")));
	assert(lines.some((line) => line.includes("[O] obs:1 | Important thing")));
	assert(lines.some((line) => line.includes("Overview: prior work")));
	assert(lines.some((line) => line.includes("View Observations Live @ http://127.0.0.1:37980")));
	assert(!lines.some((line) => line.includes("Access tokens: obs:1")), "raw access token line should not dominate header display");
});
