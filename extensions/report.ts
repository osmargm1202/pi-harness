import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadReportConfig } from "./lib/report-config.ts";

const MINUTE_MS = 60_000;
const MAX_RECENT_ERRORS = 3;

export interface ReportRuntimeState {
	startedAt?: number;
	turnCount: number;
	lastActivity: string;
	recentErrors: string[];
}

function createInitialState(): ReportRuntimeState {
	return {
		startedAt: undefined,
		turnCount: 0,
		lastActivity: "waiting for first turn",
		recentErrors: [],
	};
}

function clampPercent(percent: number): number {
	if (!Number.isFinite(percent)) return 0;
	return Math.max(0, Math.min(100, Math.round(percent)));
}

function formatElapsed(elapsedMs: number): string {
	const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}m ${seconds}s`;
}

function formatErrorSummary(event: { toolName?: unknown; error?: unknown; errorMessage?: unknown; message?: unknown }): string {
	const toolName = typeof event.toolName === "string" && event.toolName.trim().length > 0
		? event.toolName
		: "unknown tool";
	const directMessage = typeof event.errorMessage === "string" && event.errorMessage.trim().length > 0
		? event.errorMessage.trim()
		: typeof event.message === "string" && event.message.trim().length > 0
			? event.message.trim()
			: undefined;
	const nestedMessage = typeof event.error === "object" && event.error !== null && "message" in event.error
		&& typeof (event.error as { message?: unknown }).message === "string"
		&& (event.error as { message: string }).message.trim().length > 0
			? (event.error as { message: string }).message.trim()
			: undefined;
	return `${toolName}: ${directMessage ?? nestedMessage ?? "error"}`;
}

export function buildProgressBar(percent: number): string {
	const normalizedPercent = clampPercent(percent);
	const filledSlots = Math.max(0, Math.min(10, Math.round(normalizedPercent / 10)));
	return `[${"#".repeat(filledSlots)}${"-".repeat(10 - filledSlots)}]${normalizedPercent}%`;
}

export function buildReportPrompt(state: ReportRuntimeState, now = Date.now()): string {
	const elapsed = state.startedAt === undefined ? "unknown" : formatElapsed(now - state.startedAt);
	const recentErrors = state.recentErrors.length > 0 ? state.recentErrors.join(" | ") : "none detected";
	return [
		"Send one short inline progress report for the current task, then continue the original task afterward.",
		"Estimate implementation percent from the current task context.",
		"Do not invent percent if you cannot estimate it from the current work.",
		`Include a 10-slot bar exactly like ${buildProgressBar(40)} based on your estimate.`,
		"Mention why the work is not finished, what remains, and any blockers or errors if present.",
		`Runtime facts — elapsed: ${elapsed}; turns: ${state.turnCount}; last activity: ${state.lastActivity}; recent errors: ${recentErrors}.`,
	].join(" ");
}

export default function reportExtension(
	pi: ExtensionAPI,
	options?: { configPath?: string },
) {
	let timer: ReturnType<typeof setInterval> | undefined;
	let state = createInitialState();

	const stopTimer = () => {
		if (timer === undefined) return;
		clearInterval(timer);
		timer = undefined;
	};

	const resetState = () => {
		state = {
			startedAt: Date.now(),
			turnCount: 0,
			lastActivity: "agent started",
			recentErrors: [],
		};
	};

	const startTimer = () => {
		stopTimer();
		resetState();
		const config = loadReportConfig(options?.configPath);
		if (!config.enabled) return;
		timer = setInterval(() => {
			void pi.sendUserMessage(buildReportPrompt(state), { deliverAs: "steer" });
		}, config.intervalMinutes * MINUTE_MS);
	};

	pi.on("agent_start", async () => {
		startTimer();
	});

	pi.on("turn_start", async () => {
		if (state.startedAt === undefined) {
			state.startedAt = Date.now();
		}
		state.turnCount += 1;
		state.lastActivity = `turn ${state.turnCount} started`;
	});

	pi.on("tool_execution_end", async (event: { toolName?: unknown; isError?: unknown; error?: unknown; errorMessage?: unknown; message?: unknown }) => {
		const toolName = typeof event.toolName === "string" && event.toolName.trim().length > 0
			? event.toolName
			: "unknown tool";
		const isError = event.isError === true;
		state.lastActivity = `${isError ? "failed" : "finished"} ${toolName}`;
		if (!isError) return;
		state.recentErrors = [
			...state.recentErrors,
			formatErrorSummary(event),
		].slice(-MAX_RECENT_ERRORS);
	});

	pi.on("turn_end", async () => {
		const currentTurn = state.turnCount > 0 ? state.turnCount : 1;
		state.lastActivity = `turn ${currentTurn} ended`;
	});

	pi.on("agent_end", async () => {
		stopTimer();
	});

	pi.on("session_shutdown", async () => {
		stopTimer();
	});
}
