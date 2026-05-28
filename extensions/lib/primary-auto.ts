import { complete, type Message } from "@earendil-works/pi-ai";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export interface PrimaryAutoConfig {
	enabled: boolean;
}

export interface PrimaryAutoRoutingProfile {
	strict_use_for?: string[];
	best_for?: string[];
	avoid_when?: string[];
	keywords?: string[];
	subagents?: string[];
}

export interface PrimaryAutoCandidate {
	name: string;
	description: string;
	source?: string;
	members?: string[];
	routing?: PrimaryAutoRoutingProfile;
}

export interface PrimaryAutoRecommendation {
	name: string;
	reason?: string;
}

export interface PrimaryAutoDecision {
	selectedName: string;
	reason?: string;
	recommendations?: PrimaryAutoRecommendation[];
	raw?: string;
	source: "router" | "fallback";
}

export interface PrimaryAutoState {
	attempted: boolean;
	selectedName: string;
	reason?: string;
	raw?: string;
	source: "router" | "fallback";
	createdAt: number;
}

export const PRIMARY_AUTO_STATE_ENTRY = "pdd-primary-auto";

export const PRIMARY_AUTO_SYSTEM_PROMPT = `You route the user's first request to one primary agent.

Return strict JSON only with this shape:
{"selectedName":"exact-primary-name","reason":"short reason","recommendations":[{"name":"exact-primary-name","reason":"short reason"}]}

Rules:
- selectedName must exactly match the strongest recommended candidate name.
- recommendations must include up to 4 candidate names, strongest first.
- Choose only from provided primary candidates.
- Use only user request and candidate metadata.
- Prioritize routing.strict_use_for and routing.avoid_when over general description.
- Treat routing.strict_use_for as strong positive fit signals.
- Treat routing.avoid_when as strict negative fit signals unless user request clearly overrides them.
- Use routing.best_for, routing.keywords, and routing.subagents to break close ties.
- No markdown, no code fences, no extra text.`;

function normalizeJsonText(raw: string): string {
	const trimmed = raw.trim();
	if (!trimmed.startsWith("```")) return trimmed;
	return trimmed
		.replace(/^```(?:json)?\s*/i, "")
		.replace(/\s*```$/, "")
		.trim();
}

function extractResponseText(response: { content?: Array<{ type: string; text?: string }> }): string {
	return (response.content ?? [])
		.filter((item): item is { type: "text"; text: string } => item.type === "text" && typeof item.text === "string")
		.map((item) => item.text)
		.join("\n")
		.trim();
}

export function buildPrimaryAutoRouterPrompt(prompt: string, candidates: PrimaryAutoCandidate[], fallback: string): string {
	const serializedCandidates = JSON.stringify(
		candidates.map((candidate) => ({
			name: candidate.name,
			description: candidate.description,
			source: candidate.source,
			members: candidate.members,
			routing: candidate.routing,
		})),
		null,
		2,
	);

	return [
		`Fallback primary: ${fallback}`,
		"Candidates:",
		serializedCandidates,
		"",
		"First user request:",
		prompt.trim(),
	].join("\n");
}

export function resolvePrimaryAutoSelection(raw: string, candidates: PrimaryAutoCandidate[], fallback: string): PrimaryAutoDecision {
	const names = new Set(candidates.map((candidate) => candidate.name));
	try {
		const parsed = JSON.parse(normalizeJsonText(raw)) as { selectedName?: unknown; reason?: unknown; recommendations?: unknown };
		const selectedName = typeof parsed.selectedName === "string" ? parsed.selectedName.trim() : "";
		if (selectedName && names.has(selectedName)) {
			const recommendations = Array.isArray(parsed.recommendations)
				? parsed.recommendations
					.map((item): PrimaryAutoRecommendation | undefined => {
						if (!item || typeof item !== "object") return undefined;
						const name = typeof (item as { name?: unknown }).name === "string" ? (item as { name: string }).name.trim() : "";
						if (!name || !names.has(name)) return undefined;
						const reason = typeof (item as { reason?: unknown }).reason === "string" ? (item as { reason: string }).reason.trim() : undefined;
						return { name, reason };
					})
					.filter((item): item is PrimaryAutoRecommendation => Boolean(item))
				: undefined;
			return {
				selectedName,
				reason: typeof parsed.reason === "string" ? parsed.reason.trim() : undefined,
				recommendations,
				raw,
				source: "router",
			};
		}
	} catch {
		// fall through to safe fallback
	}

	return { selectedName: fallback, raw, source: "fallback" };
}

export function normalizePrimaryAutoDecision(
	decision: Pick<PrimaryAutoDecision, "selectedName" | "reason" | "recommendations"> | undefined,
	candidates: PrimaryAutoCandidate[],
	fallback: string,
): PrimaryAutoDecision {
	if (!decision) return { selectedName: fallback, source: "fallback" };
	return resolvePrimaryAutoSelection(JSON.stringify(decision), candidates, fallback);
}

export function restorePrimaryAutoState(entries: readonly any[]): PrimaryAutoState | undefined {
	for (let index = entries.length - 1; index >= 0; index -= 1) {
		const entry = entries[index];
		if (entry?.type !== "custom" || entry.customType !== PRIMARY_AUTO_STATE_ENTRY) continue;
		const data = entry.data;
		if (typeof data?.attempted !== "boolean" || typeof data?.selectedName !== "string") continue;
		return {
			attempted: data.attempted,
			selectedName: data.selectedName,
			reason: typeof data.reason === "string" ? data.reason : undefined,
			raw: typeof data.raw === "string" ? data.raw : undefined,
			source: data.source === "router" ? "router" : "fallback",
			createdAt: typeof data.createdAt === "number" ? data.createdAt : 0,
		};
	}
	return undefined;
}

export async function routePrimaryAuto(args: {
	ctx: ExtensionContext;
	prompt: string;
	candidates: PrimaryAutoCandidate[];
	fallback: string;
}): Promise<PrimaryAutoDecision> {
	const { ctx, prompt, candidates, fallback } = args;
	if (!ctx.model || candidates.length === 0) return { selectedName: fallback, source: "fallback" };

	const auth = await ctx.modelRegistry.getApiKeyAndHeaders(ctx.model);
	if (!auth.ok || !auth.apiKey) return { selectedName: fallback, source: "fallback" };

	const message: Message = {
		role: "user",
		content: [{ type: "text", text: buildPrimaryAutoRouterPrompt(prompt, candidates, fallback) }],
		timestamp: Date.now(),
	};

	const response = await complete(
		ctx.model,
		{ systemPrompt: PRIMARY_AUTO_SYSTEM_PROMPT, messages: [message] },
		{ apiKey: auth.apiKey, headers: auth.headers, signal: ctx.signal },
	);
	if (response.stopReason === "aborted") return { selectedName: fallback, source: "fallback" };
	return resolvePrimaryAutoSelection(extractResponseText(response), candidates, fallback);
}
