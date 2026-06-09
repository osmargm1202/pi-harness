import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { isOrgmExtensionEnabled } from "./lib/orgm-extension-config.ts";
import {
	LIMITS_EVENT,
	MINIMAX_CN_USAGE_URL,
	displayModel,
	fetchMinimaxUsageSnapshot,
	fetchUsageSnapshot,
	providerLimitKind,
	readCodexAuth,
	readMinimaxApiKey,
	unsupportedLimitsDisplayModel,
	type LimitSnapshot,
} from "./lib/limit-usage.ts";

const REFRESH_INTERVAL_MS = 120_000;

export default function (pi: ExtensionAPI) {
	if (!isOrgmExtensionEnabled("limit")) return;

	let timer: ReturnType<typeof setInterval> | undefined;
	let lastSnapshot: LimitSnapshot | undefined;
	let warnedAuth = false;
	let currentCtx: ExtensionContext | undefined;

	const emit = (ctx: ExtensionContext, stale = false, error?: string) => {
		pi.events.emit(LIMITS_EVENT, displayModel(lastSnapshot, stale, error));
		if (ctx.hasUI) ctx.ui.setStatus("orgm-limit", undefined);
	};

	const refresh = async (ctx: ExtensionContext) => {
		currentCtx = ctx;
		const kind = providerLimitKind(ctx.model);
		if (kind === "unsupported") {
			lastSnapshot = undefined;
			pi.events.emit(LIMITS_EVENT, unsupportedLimitsDisplayModel(typeof ctx.model?.provider === "string" ? ctx.model.provider : undefined));
			if (ctx.hasUI) ctx.ui.setStatus("orgm-limit", undefined);
			return;
		}
		if (kind === "minimax") {
			const apiKey = readMinimaxApiKey();
			if (!apiKey) {
				lastSnapshot = undefined;
				pi.events.emit(LIMITS_EVENT, unsupportedLimitsDisplayModel("minimax"));
				if (!warnedAuth && ctx.hasUI) {
					warnedAuth = true;
					ctx.ui.notify("MiniMax auth not found; limits unavailable", "warning");
				}
				return;
			}
			try {
				const url = ctx.model?.provider === "minimax-cn" ? MINIMAX_CN_USAGE_URL : undefined;
				lastSnapshot = await fetchMinimaxUsageSnapshot(apiKey, fetch, url);
				emit(ctx, false);
			} catch {
				if (lastSnapshot) emit(ctx, true, "fetch-failed");
				else pi.events.emit(LIMITS_EVENT, unsupportedLimitsDisplayModel("minimax"));
			}
			return;
		}

		const auth = readCodexAuth();
		if (!auth) {
			emit(ctx, false, "missing-auth");
			if (!warnedAuth && ctx.hasUI) {
				warnedAuth = true;
				ctx.ui.notify("Codex auth not found; limits unavailable", "warning");
			}
			return;
		}
		try {
			lastSnapshot = await fetchUsageSnapshot(auth);
			emit(ctx, false);
		} catch {
			emit(ctx, Boolean(lastSnapshot), "fetch-failed");
		}
	};

	const stopTimer = () => {
		if (timer) clearInterval(timer);
		timer = undefined;
	};

	const startTimer = (ctx: ExtensionContext) => {
		stopTimer();
		timer = setInterval(() => {
			void refresh(ctx);
		}, REFRESH_INTERVAL_MS);
	};

	pi.on("session_start", async (_event, ctx) => {
		if (!ctx.hasUI) return;
		currentCtx = ctx;
		emit(ctx, false);
		await refresh(ctx);
		startTimer(ctx);
	});

	pi.on("model_select", async (_event, ctx) => {
		if (!ctx.hasUI) return;
		await refresh(ctx);
	});

	pi.on("session_shutdown", async () => {
		stopTimer();
		currentCtx = undefined;
	});

	pi.registerCommand("orgm-limits", {
		description: "Refresh active provider usage limit display",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) return;
			await refresh(ctx);
			ctx.ui.notify("Limits refreshed", "success");
		},
	});
}
