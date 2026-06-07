import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	authFileCandidates,
	formatLimitBar,
	formatLimitMetric,
	formatLimitsRow,
	parseUsagePayload,
	readCodexAuth,
	remainingPercent,
} from "../extensions/lib/limit-usage.ts";

assert.equal(remainingPercent(0), 100, "0 used means 100 remaining");
assert.equal(remainingPercent(8), 92, "8 used means 92 remaining");
assert.equal(remainingPercent(10), 90, "10 used means 90 remaining");
assert.equal(remainingPercent(100), 0, "100 used means 0 remaining");
assert.equal(remainingPercent(140), 0, "remaining clamps low");
assert.equal(remainingPercent(-20), 100, "remaining clamps high");
assert.equal(remainingPercent(undefined), undefined, "missing remains missing");

assert.equal(formatLimitBar(100), "[##########]");
assert.equal(formatLimitBar(92), "[#########-]");
assert.equal(formatLimitBar(90), "[#########-]");
assert.equal(formatLimitBar(0), "[----------]");
assert.equal(formatLimitBar(undefined), "[----------]");

assert.equal(formatLimitMetric("Codex 5H", 90), "Codex 5H [#########-] 90%");
assert.equal(formatLimitMetric("Spark S", undefined), "Spark S [----------] --%");

const payload = {
	plan_type: "pro",
	rate_limit: {
		primary_window: { used_percent: 10, reset_at: 1735401600, limit_window_seconds: 18000 },
		secondary_window: { used_percent: 8, reset_at: 1735920000, limit_window_seconds: 604800 },
	},
	additional_rate_limits: [
		{
			limit_name: "GPT-5.3-Codex-Spark",
			metered_feature: "codex_bengalfox",
			rate_limit: {
				primary_window: { used_percent: 50, reset_at: 1735401600, limit_window_seconds: 18000 },
				secondary_window: { used_percent: 20, reset_at: 1735920000, limit_window_seconds: 604800 },
			},
		},
	],
};

const parsed = parseUsagePayload(payload);
assert.equal(parsed.planType, "pro");
assert.equal(parsed.codex.primary?.remainingPercent, 90);
assert.equal(parsed.codex.secondary?.remainingPercent, 92);
assert.equal(parsed.spark.primary?.remainingPercent, 50);
assert.equal(parsed.spark.secondary?.remainingPercent, 80);

assert.equal(
	formatLimitsRow(parsed, "full"),
	"Codex 5H [#########-] 90% | Codex S [#########-] 92% | Spark 5H [#####-----] 50% | Spark S [########--] 80%",
);
assert.equal(
	formatLimitsRow(parsed, "compact"),
	"C 5H [#########-] 90% | C S [#########-] 92% | SP 5H [#####-----] 50% | SP S [########--] 80%",
);

const noSpark = parseUsagePayload({
	rate_limit: {
		primary_window: { used_percent: 0 },
		secondary_window: { used_percent: 100 },
	},
});
assert.equal(
	formatLimitsRow(noSpark, "full"),
	"Codex 5H [##########] 100% | Codex S [----------] 0% | Spark 5H [----------] --% | Spark S [----------] --%",
);

const tempDir = mkdtempSync(join(tmpdir(), "limit-auth-"));
try {
	const codeHome = join(tempDir, "codex-home");
	const fakeHome = join(tempDir, "home");
	mkdirSync(codeHome, { recursive: true });
	mkdirSync(join(fakeHome, ".config", "codex"), { recursive: true });
	mkdirSync(join(fakeHome, ".codex"), { recursive: true });

	assert.deepEqual(authFileCandidates({ CODEX_HOME: codeHome }, fakeHome), [
		join(codeHome, "auth.json"),
		join(fakeHome, ".config", "codex", "auth.json"),
		join(fakeHome, ".codex", "auth.json"),
	]);

	writeFileSync(join(fakeHome, ".codex", "auth.json"), JSON.stringify({
		tokens: {
			access_token: "fallback-access",
			refresh_token: "fallback-refresh",
			account_id: "fallback-account",
		},
	}), "utf8");
	writeFileSync(join(codeHome, "auth.json"), JSON.stringify({
		tokens: {
			access_token: "primary-access",
			refresh_token: "primary-refresh",
			account_id: "primary-account",
		},
	}), "utf8");

	const auth = readCodexAuth({ CODEX_HOME: codeHome }, fakeHome);
	assert.equal(auth?.tokens.accessToken, "primary-access");
	assert.equal(auth?.tokens.refreshToken, "primary-refresh");
	assert.equal(auth?.tokens.accountId, "primary-account");

	writeFileSync(join(codeHome, "auth.json"), "{not-json", "utf8");
	assert.equal(readCodexAuth({ CODEX_HOME: codeHome }, fakeHome)?.tokens.accessToken, "fallback-access", "invalid primary auth should fall back to next auth file");
} finally {
	rmSync(tempDir, { recursive: true, force: true });
}

const limitExtensionSource = readFileSync(new URL("../extensions/limit.ts", import.meta.url), "utf8");
assert(limitExtensionSource.includes('isOrgmExtensionEnabled("limit")'), "limit extension should be gated by orgm extension config");
assert(limitExtensionSource.includes("LIMITS_EVENT"), "limit extension should emit limits event");
assert(limitExtensionSource.includes("setInterval"), "limit extension should refresh on an interval");
assert(limitExtensionSource.includes("session_shutdown"), "limit extension should cleanup timer on shutdown");
