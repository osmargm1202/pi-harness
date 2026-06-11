import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderInlineLimitRows } from "../extensions/limit.ts";
import { displayModel, parseUsagePayload } from "../extensions/lib/limit-usage.ts";

const source = readFileSync(new URL("../extensions/limit.ts", import.meta.url), "utf8");
assert(source.includes("registerMessageRenderer"), "limit extension should register inline message renderer");
assert(source.includes("orgm-limits"), "limit extension should keep orgm-limits command");
assert(source.includes("pi.sendMessage"), "limit command should send inline display message");
assert(!source.includes("setInterval"), "limit extension should not auto-refresh with timer");
assert(!source.includes("session_start"), "limit extension should not refresh on session start");
assert(!source.includes("model_select"), "limit extension should not refresh on model select");
assert(!source.includes("ctx.ui.setStatus(\"orgm-limit"), "limit extension should not write persistent footer status");

const parsed = parseUsagePayload({
	rate_limit: {
		primary_window: { used_percent: 18, reset_at: 1780964760, limit_window_seconds: 18000 },
		secondary_window: { used_percent: 39, reset_at: 1781223960, limit_window_seconds: 604800 },
	},
});
const rows = renderInlineLimitRows(displayModel(parsed, false, undefined, new Date("2026-06-07T07:15:00Z")));
assert.equal(rows.length, 1, "inline limits should render one compact command-output row by default");
assert(rows[0]?.startsWith("ChatGPT limits · "), "inline limits should use ChatGPT limits prefix");
assert(rows[0]?.includes("C  5H"), "inline limits should use compact rows");

const missing = renderInlineLimitRows(displayModel(undefined, false, "missing-auth"));
assert.deepEqual(missing, ["ChatGPT limits · no auth"], "missing auth should render inline message");

const fetchFailed = renderInlineLimitRows(displayModel(undefined, false, "fetch-failed"));
assert.deepEqual(fetchFailed, ["ChatGPT limits · fetch failed"], "fetch failures should render clear inline message");
