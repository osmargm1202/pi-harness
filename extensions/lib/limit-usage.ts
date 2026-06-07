import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const LIMITS_EVENT = "orgm:limits-changed";
export const CODEX_USAGE_URL = "https://chatgpt.com/backend-api/wham/usage";
export const CODEX_REFRESH_URL = "https://auth.openai.com/oauth/token";
export const CODEX_OAUTH_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
export const DEFAULT_RESET_TIME_ZONE = "America/Santo_Domingo";

export type LimitWindow = {
	usedPercent?: number;
	remainingPercent?: number;
	resetAt?: number;
	windowSeconds?: number;
};

export type LimitBucket = {
	limitId: string;
	limitName?: string;
	primary?: LimitWindow;
	secondary?: LimitWindow;
};

export type LimitSnapshot = {
	planType?: string;
	codex: LimitBucket;
	spark: LimitBucket;
	updatedAt: number;
};

export type LimitDisplayModel = {
	snapshot?: LimitSnapshot;
	fullText: string;
	compactText: string;
	fullRows: string[];
	compactRows: string[];
	stale: boolean;
	error?: string;
};

export type LimitColorKind = "normal" | "error" | "warning" | "success";

type RawWindow = {
	used_percent?: unknown;
	reset_at?: unknown;
	limit_window_seconds?: unknown;
};

type RawRateLimit = {
	primary_window?: RawWindow | null;
	secondary_window?: RawWindow | null;
};

type RawAdditionalLimit = {
	limit_name?: unknown;
	metered_feature?: unknown;
	rate_limit?: RawRateLimit | null;
};

type RawUsagePayload = {
	plan_type?: unknown;
	rate_limit?: RawRateLimit | null;
	additional_rate_limits?: RawAdditionalLimit[] | null;
};

export type CodexAuthTokens = {
	accessToken: string;
	refreshToken?: string;
	idToken?: string;
	accountId?: string;
};

export type CodexAuthFile = {
	path: string;
	raw: Record<string, unknown>;
	tokens: CodexAuthTokens;
};

function numberFrom(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringFrom(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function remainingPercent(usedPercent: number | undefined): number | undefined {
	if (usedPercent === undefined || !Number.isFinite(usedPercent)) return undefined;
	return Math.max(0, Math.min(100, Math.round(100 - usedPercent)));
}

export function formatLimitBar(percent: number | undefined, width = 10): string {
	if (percent === undefined) return `[${"-".repeat(width)}]`;
	const clamped = Math.max(0, Math.min(100, percent));
	const filled = Math.max(0, Math.min(width, Math.round(clamped / 10)));
	return `[${"#".repeat(filled)}${"-".repeat(width - filled)}]`;
}

export function limitColorKind(percent: number | undefined): LimitColorKind {
	if (percent === undefined) return "normal";
	if (percent === 0) return "error";
	if (percent >= 1 && percent <= 29) return "warning";
	if (percent >= 30 && percent <= 50) return "success";
	return "normal";
}

export function formatLimitMetric(label: string, percent: number | undefined): string {
	return `${label} ${formatLimitBar(percent)}${percent === undefined ? "--" : Math.round(percent)}%`;
}

type ResetDateParts = {
	year: string;
	month: string;
	day: string;
	hour: string;
	minute: string;
	dayPeriod: string;
};

function resetDateParts(date: Date, timeZone = DEFAULT_RESET_TIME_ZONE): ResetDateParts {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	}).formatToParts(date);
	const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
	return {
		year: value("year"),
		month: value("month"),
		day: value("day"),
		hour: value("hour"),
		minute: value("minute"),
		dayPeriod: value("dayPeriod"),
	};
}

function formatClock(parts: ResetDateParts): string {
	return `${parts.hour}:${parts.minute}${parts.dayPeriod}`;
}

export function formatResetLabel(resetAt: number | undefined, now: Date = new Date(), timeZone = DEFAULT_RESET_TIME_ZONE): string {
	if (resetAt === undefined || !Number.isFinite(resetAt)) return "--";
	const resetParts = resetDateParts(new Date(resetAt * 1000), timeZone);
	const nowParts = resetDateParts(now, timeZone);
	const time = formatClock(resetParts);
	if (
		resetParts.year === nowParts.year &&
		resetParts.month === nowParts.month &&
		resetParts.day === nowParts.day
	) return time;
	return `${resetParts.month} ${resetParts.day}, ${resetParts.year} ${time}`;
}

function formatLimitMetricWithReset(label: string, window: LimitWindow | undefined, now: Date): string {
	return `${formatLimitMetric(label, window?.remainingPercent)} ${formatResetLabel(window?.resetAt, now)}`;
}

function exhaustedResetWindow(bucket: LimitBucket | undefined): LimitWindow | undefined {
	if (bucket?.secondary?.remainingPercent === 0) return bucket.secondary;
	if (bucket?.primary?.remainingPercent === 0) return bucket.primary;
	return undefined;
}

function parseWindow(window: RawWindow | null | undefined): LimitWindow | undefined {
	if (!window) return undefined;
	const usedPercent = numberFrom(window.used_percent);
	const resetAt = numberFrom(window.reset_at);
	const windowSeconds = numberFrom(window.limit_window_seconds);
	if (usedPercent === undefined && resetAt === undefined && windowSeconds === undefined) return undefined;
	return {
		usedPercent,
		remainingPercent: remainingPercent(usedPercent),
		resetAt,
		windowSeconds,
	};
}

function parseBucket(limitId: string, limitName: string | undefined, rateLimit: RawRateLimit | null | undefined): LimitBucket {
	return {
		limitId,
		limitName,
		primary: parseWindow(rateLimit?.primary_window),
		secondary: parseWindow(rateLimit?.secondary_window),
	};
}

function findSparkLimit(additional: RawUsagePayload["additional_rate_limits"]): RawAdditionalLimit | undefined {
	if (!Array.isArray(additional)) return undefined;
	return additional.find((item) => {
		const id = stringFrom(item?.metered_feature)?.toLowerCase() ?? "";
		const name = stringFrom(item?.limit_name)?.toLowerCase() ?? "";
		return id.includes("bengalfox") || id.includes("spark") || name.includes("spark");
	});
}

export function parseUsagePayload(payload: unknown): LimitSnapshot {
	const raw = (payload && typeof payload === "object" ? payload : {}) as RawUsagePayload;
	const sparkRaw = findSparkLimit(raw.additional_rate_limits);
	return {
		planType: stringFrom(raw.plan_type),
		codex: parseBucket("codex", undefined, raw.rate_limit),
		spark: parseBucket(
			stringFrom(sparkRaw?.metered_feature) ?? "codex_bengalfox",
			stringFrom(sparkRaw?.limit_name) ?? "GPT-5.3-Codex-Spark",
			sparkRaw?.rate_limit,
		),
		updatedAt: Date.now(),
	};
}

export function formatLimitsRow(snapshot: LimitSnapshot | undefined, mode: "full" | "compact" = "full"): string {
	const codex = snapshot?.codex;
	const spark = snapshot?.spark;
	const labels = mode === "full"
		? ["Codex 5H", "Codex S", "Spark 5H", "Spark S"]
		: ["C 5H", "C S", "SP 5H", "SP S"];
	return [
		formatLimitMetric(labels[0]!, codex?.primary?.remainingPercent),
		formatLimitMetric(labels[1]!, codex?.secondary?.remainingPercent),
		formatLimitMetric(labels[2]!, spark?.primary?.remainingPercent),
		formatLimitMetric(labels[3]!, spark?.secondary?.remainingPercent),
	].join(" | ");
}

export function formatLimitRows(snapshot: LimitSnapshot | undefined, mode: "full" | "compact" = "full", now: Date = new Date()): string[] {
	const codex = snapshot?.codex;
	const spark = snapshot?.spark;
	const labels = mode === "full"
		? ["Codex", "Spark"]
		: ["C", "SP"];
	const replenishmentLabel = mode === "full" ? "reposición" : "repo";
	const formatGroupRow = (label: string, bucket: LimitBucket | undefined) => {
		const exhaustedWindow = exhaustedResetWindow(bucket);
		if (exhaustedWindow) return `${label}  ${replenishmentLabel} ${formatResetLabel(exhaustedWindow.resetAt, now)}`;
		return `${label}  ${formatLimitMetricWithReset("5H", bucket?.primary, now)} | ${formatLimitMetricWithReset("S", bucket?.secondary, now)}`;
	};
	return [
		formatGroupRow(labels[0]!, codex),
		formatGroupRow(labels[1]!, spark),
	];
}

export function authFileCandidates(env: NodeJS.ProcessEnv = process.env, home = homedir()): string[] {
	const candidates: string[] = [];
	if (env.CODEX_HOME?.trim()) candidates.push(join(env.CODEX_HOME, "auth.json"));
	candidates.push(join(home, ".config", "codex", "auth.json"));
	candidates.push(join(home, ".codex", "auth.json"));
	return candidates;
}

export function readCodexAuth(env: NodeJS.ProcessEnv = process.env, home = homedir()): CodexAuthFile | undefined {
	for (const path of authFileCandidates(env, home)) {
		if (!existsSync(path)) continue;
		let raw: Record<string, unknown>;
		try {
			raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
		} catch {
			continue;
		}
		const tokens = raw.tokens && typeof raw.tokens === "object" ? raw.tokens as Record<string, unknown> : raw;
		const accessToken = stringFrom(tokens.access_token);
		if (!accessToken) continue;
		return {
			path,
			raw,
			tokens: {
				accessToken,
				refreshToken: stringFrom(tokens.refresh_token),
				idToken: stringFrom(tokens.id_token),
				accountId: stringFrom(tokens.account_id),
			},
		};
	}
	return undefined;
}

export function writeUpdatedAuth(auth: CodexAuthFile, next: Partial<CodexAuthTokens>): void {
	const raw = { ...auth.raw };
	const existingTokens = raw.tokens && typeof raw.tokens === "object" ? raw.tokens as Record<string, unknown> : {};
	raw.tokens = {
		...existingTokens,
		access_token: next.accessToken ?? auth.tokens.accessToken,
		refresh_token: next.refreshToken ?? auth.tokens.refreshToken,
		id_token: next.idToken ?? auth.tokens.idToken,
		account_id: next.accountId ?? auth.tokens.accountId,
	};
	raw.last_refresh = new Date().toISOString();
	writeFileSync(auth.path, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
}

export async function refreshAccessToken(refreshToken: string, fetchImpl: typeof fetch = fetch): Promise<Partial<CodexAuthTokens> | undefined> {
	const body = new URLSearchParams({
		client_id: CODEX_OAUTH_CLIENT_ID,
		grant_type: "refresh_token",
		refresh_token: refreshToken,
	});
	const response = await fetchImpl(CODEX_REFRESH_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "codex-cli" },
		body,
	});
	if (!response.ok) return undefined;
	const payload = await response.json() as Record<string, unknown>;
	return {
		accessToken: stringFrom(payload.access_token),
		refreshToken: stringFrom(payload.refresh_token),
		idToken: stringFrom(payload.id_token),
	};
}

export async function fetchUsageSnapshot(auth: CodexAuthFile, fetchImpl: typeof fetch = fetch): Promise<LimitSnapshot> {
	const request = async (accessToken: string) => fetchImpl(CODEX_USAGE_URL, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${accessToken}`,
			Accept: "application/json",
			"User-Agent": "codex-cli",
			...(auth.tokens.accountId ? { "ChatGPT-Account-Id": auth.tokens.accountId } : {}),
		},
	});

	let response = await request(auth.tokens.accessToken);
	if (response.status === 401 && auth.tokens.refreshToken) {
		const refreshed = await refreshAccessToken(auth.tokens.refreshToken, fetchImpl);
		if (refreshed?.accessToken) {
			writeUpdatedAuth(auth, refreshed);
			response = await request(refreshed.accessToken);
		}
	}
	if (!response.ok) throw new Error(`Usage fetch failed: ${response.status}`);
	return parseUsagePayload(await response.json());
}

export function displayModel(snapshot: LimitSnapshot | undefined, stale = false, error?: string, now: Date = new Date()): LimitDisplayModel {
	return {
		snapshot,
		fullText: formatLimitsRow(snapshot, "full"),
		compactText: formatLimitsRow(snapshot, "compact"),
		fullRows: formatLimitRows(snapshot, "full", now),
		compactRows: formatLimitRows(snapshot, "compact", now),
		stale,
		error,
	};
}

export function normalizeLimitDisplayModel(data: LimitDisplayModel | undefined): LimitDisplayModel {
	if (data?.fullRows?.length && data?.compactRows?.length) return data;
	if (data?.fullText && data?.compactText) {
		return {
			...data,
			fullRows: [data.fullText],
			compactRows: [data.compactText],
		};
	}
	return displayModel(undefined);
}
