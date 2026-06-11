export const PI_MEM_CONTEXT_INDEX_EVENT = "pi-mem:context-index";
export const PI_MEM_CONTEXT_INDEX_WIDGET = "orgm-pi-mem-context-index";

export type PiMemContextIndexPayload = {
	content: string;
	viewerUrl: string;
	counts: {
		observations: number;
		sessions: number;
	};
	tokens: string[];
	summary: string;
	project: string;
	sessionId: string;
	eventName?: string;
	format?: string;
	queryHash?: string;
	contentHash?: string;
	emittedAt?: string;
};

export function normalizePiMemContextIndexEvent(data: unknown): PiMemContextIndexPayload | undefined {
	if (!data || typeof data !== "object") return undefined;
	const record = data as Record<string, unknown>;
	const counts = record.counts && typeof record.counts === "object" ? record.counts as Record<string, unknown> : {};
	const content = asString(record.content);
	if (!content) return undefined;
	return {
		content,
		viewerUrl: asString(record.viewerUrl) || "unavailable",
		counts: {
			observations: asNumber(counts.observations),
			sessions: asNumber(counts.sessions),
		},
		tokens: Array.isArray(record.tokens) ? record.tokens.map(String).filter(Boolean) : [],
		summary: asString(record.summary) || summarizeContent(content),
		project: asString(record.project) || "unknown",
		sessionId: asString(record.sessionId) || "unknown",
		eventName: asString(record.eventName),
		format: asString(record.format),
		queryHash: asString(record.queryHash),
		contentHash: asString(record.contentHash),
		emittedAt: asString(record.emittedAt),
	};
}

export function materialPiMemContextIndexKey(payload: PiMemContextIndexPayload): string {
	return payload.queryHash || payload.contentHash || [payload.project, payload.sessionId, payload.counts.observations, payload.counts.sessions, payload.summary, payload.viewerUrl].join("|");
}

export function renderPiMemContextIndexWidget(
	payload: PiMemContextIndexPayload,
	width: number,
	style: (kind: "accent" | "muted" | "success", text: string) => string = (_kind, text) => text,
): string[] {
	const max = Math.max(48, width);
	const viewer = payload.viewerUrl && payload.viewerUrl !== "unavailable" ? payload.viewerUrl : "viewer unavailable";
	const date = payload.emittedAt ? new Date(payload.emittedAt) : new Date();
	const stamp = Number.isNaN(date.getTime()) ? "recent context" : `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
	const raw = extractRenderableContextLines(payload.content);
	const body = raw.length > 0 ? raw : [payload.summary];
	const tokenCount = payload.tokens.length;
	const lines: string[] = [
		style("accent", trimToWidth(`π pi-mem SessionStart:${payload.eventName ?? "startup"} says: ${payload.project} recent context, ${stamp}`, max)),
		style("muted", trimToWidth("─".repeat(Math.min(max, 80)), max)),
		"",
	];
	for (const line of body.slice(0, 34)) {
		lines.push(style(classifyContextLine(line), trimToWidth(line, max)));
	}
	if (body.length > 34) {
		lines.push(style("muted", trimToWidth(`… ${body.length - 34} more context lines available in viewer`, max)));
	}
	lines.push("");
	lines.push(style("accent", trimToWidth(`Access ${tokenCount || "local"} memory handles from pi-mem. Use pi_mem_get/search for full records.`, max)));
	lines.push(style("success", trimToWidth(`View Observations Live @ ${viewer}`, max)));
	return lines;
}

function extractRenderableContextLines(content: string): string[] {
	return content
		.replace(/<\/?pi-mem>/g, "")
		.split(/\r?\n/)
		.map((line) => line.trimEnd())
		.filter((line) => line.trim().length > 0)
		.filter((line) => !line.startsWith("Access tokens:"))
		.map((line) => line.replace(/^Context Index Instructions$/, "Context Index:"));
}

function classifyContextLine(line: string): "accent" | "muted" | "success" {
	if (/^(Legend|Column Key|Context Index:|Context Economics|Observations by Date and File|Session Summaries)$/i.test(line)) return "accent";
	if (/^View Observations Live/i.test(line)) return "success";
	return "muted";
}

function asString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asNumber(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function summarizeContent(content: string): string {
	const match = content.match(/Context Economics\s+([^\n]+)/i) ?? content.match(/Observations by Date and File\s+([^\n]+)/i);
	return trimToWidth((match?.[1] ?? content).replace(/\s+/g, " ").trim(), 160);
}

function trimToWidth(value: string, width: number): string {
	const chars = Array.from(value.replace(/\s+/g, " ").trim());
	if (chars.length <= width) return chars.join("");
	return `${chars.slice(0, Math.max(0, width - 1)).join("")}…`;
}
