import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { type SelectItem } from "@earendil-works/pi-tui";
import {
	discoverPrimaryAgents,
	findPrimaryAgent,
	formatPrimaryLabel,
	PRIMARY_STATE_EVENT,
	PRIMARY_STATE_ENTRY,
	restorePrimaryState,
	SYSTEM_AGENT,
} from "./lib/agent-discovery.ts";
import {
	normalizePrimaryAutoDecision,
	PRIMARY_AUTO_STATE_ENTRY,
	restorePrimaryAutoState,
	routePrimaryAuto,
	type PrimaryAutoCandidate,
	type PrimaryAutoDecision,
} from "./lib/primary-auto.ts";
import { loadOrgmConfig, saveOrgmConfigSlice } from "./lib/orgm-config.ts";
import { resolveConfiguredPrimary } from "./lib/orgm-flow.ts";
import { createSelectPanel } from "./lib/tui-select-panel.ts";

function isSubagentRuntime(): boolean {
	return process.env.PI_PDD_SUBAGENT === "1" || process.env.PI_SUBAGENT_RUNTIME_ID !== undefined || process.env.PI_SUBAGENT_RUNTIME_DEPTH !== undefined;
}

interface SelectorItem extends SelectItem {
	description: string;
}

const PRIMARY_AUTO_NONE_LABEL = "Pi solo (sin agente primario)";

interface ModelPrimaryOptions {
	configPath?: string;
	routePrimary?: (args: {
		ctx: ExtensionContext;
		prompt: string;
		candidates: PrimaryAutoCandidate[];
		fallback: string;
	}) => Promise<Pick<PrimaryAutoDecision, "selectedName" | "reason" | "recommendations"> | PrimaryAutoDecision | undefined>;
}

function setPrimaryAgent(
	pi: ExtensionAPI,
	name: string,
	options?: { persistConfig?: boolean; configPath?: string },
): void {
	pi.appendEntry(PRIMARY_STATE_ENTRY, { selectedName: name });
	if (options?.persistConfig !== false) saveOrgmConfigSlice("defaultPrimaryAgent", name, options?.configPath);
	pi.events.emit(PRIMARY_STATE_EVENT, { selectedName: name });
}

function buildSelectorItems(currentPrimary: string, cwd: string): SelectorItem[] {
	const items: SelectorItem[] = [{
		value: SYSTEM_AGENT,
		label: SYSTEM_AGENT,
		description: "No primary overlay — use pi defaults",
	}];

	for (const agent of discoverPrimaryAgents(cwd, "both")) {
		items.push({
			value: agent.name,
			label: agent.name === currentPrimary ? `${agent.name}  ✓ current` : agent.name,
			description: agent.description || "",
		});
	}
	return items;
}

function buildPrimaryAutoCandidates(cwd: string): PrimaryAutoCandidate[] {
	return discoverPrimaryAgents(cwd, "both").map((agent) => ({
		name: agent.name,
		description: agent.description,
		source: agent.source,
		routing: agent.routing,
	}));
}

function buildPrimaryAutoSelectorItems(
	candidates: PrimaryAutoCandidate[],
	decision: PrimaryAutoDecision,
): SelectorItem[] {
	const byName = new Map(candidates.map((candidate) => [candidate.name, candidate]));
	const reasons = new Map<string, string>();
	const orderedNames: string[] = [];
	const pushName = (name: string, reason?: string) => {
		if (!byName.has(name) || orderedNames.includes(name)) return;
		orderedNames.push(name);
		if (reason) reasons.set(name, reason);
	};

	pushName(decision.selectedName, decision.reason);
	for (const recommendation of decision.recommendations ?? []) {
		pushName(recommendation.name, recommendation.reason);
	}
	for (const candidate of candidates) {
		pushName(candidate.name);
		if (orderedNames.length >= 4) break;
	}

	const items = orderedNames.slice(0, 4).map((name, index) => {
		const candidate = byName.get(name)!;
		const top = index === 0;
		return {
			value: name,
			label: `${top ? "* " : "  "}${name}`,
			description: reasons.get(name) || candidate.description || "",
		};
	});

	items.push({
		value: SYSTEM_AGENT,
		label: `  ${PRIMARY_AUTO_NONE_LABEL}`,
		description: "Sin overlay de agente primario; usar Pi por defecto",
	});

	return items;
}

function hasExistingConversation(entries: readonly any[]): boolean {
	return entries.some((entry) => entry?.type === "message" || entry?.type === "compaction");
}

async function openSelectPalette(
	ctx: ExtensionContext,
	title: string,
	subtitle: string,
	items: SelectorItem[],
): Promise<string | null> {
	if (!ctx.hasUI) return null;

	try {
		return await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
			const { container, selectList } = createSelectPanel({
				theme,
				title,
				subtitle,
				help: "↑↓ navigate • enter select • esc cancel",
				items,
				maxHeight: 12,
			});
			selectList.onSelect = (item) => done(item.value);
			selectList.onCancel = () => done(null);

			return {
				render: (w: number) => container.render(w),
				invalidate: () => container.invalidate(),
				handleInput: (data: string) => {
					if (data === "\u001B" || data === "Escape" || data === "escape") {
						done(null);
						return;
					}
					selectList.handleInput(data);
					tui.requestRender();
				},
			};
		}, { overlay: true });
	} catch (error) {
		console.error("openPrimaryPalette error:", error);
		return null;
	}
}

export default function modelPrimaryExtension(pi: ExtensionAPI, options: ModelPrimaryOptions = {}) {
	let currentPrimary = SYSTEM_AGENT;
	let primaryAutoEnabled = loadOrgmConfig(options.configPath).primaryAuto.enabled;
	let primaryAutoAttempted = false;
	const routePrimary = options.routePrimary ?? routePrimaryAuto;

	const persistPrimaryAutoState = (decision: PrimaryAutoDecision) => {
		pi.appendEntry(PRIMARY_AUTO_STATE_ENTRY, {
			attempted: true,
			selectedName: decision.selectedName,
			reason: decision.reason,
			raw: decision.raw,
			source: decision.source,
			createdAt: Date.now(),
		});
	};

	pi.on("session_start", async (_event, ctx) => {
		const config = loadOrgmConfig(options.configPath);
		const entries = ctx.sessionManager.getEntries();
		const savedAutoState = restorePrimaryAutoState(entries);
		primaryAutoEnabled = config.primaryAuto.enabled;
		primaryAutoAttempted = savedAutoState?.attempted ?? hasExistingConversation(entries);
		currentPrimary = resolveConfiguredPrimary(
			ctx.cwd,
			restorePrimaryState(entries, ctx.cwd, "both"),
			config,
		);
		if (savedAutoState?.selectedName) {
			currentPrimary = savedAutoState.selectedName === SYSTEM_AGENT
				? SYSTEM_AGENT
				: resolveConfiguredPrimary(ctx.cwd, savedAutoState.selectedName, config);
		}
		pi.events.emit(PRIMARY_STATE_EVENT, { selectedName: currentPrimary });
	});

	pi.on("before_agent_start", async (event, ctx) => {
		if (isSubagentRuntime()) return;

		if (primaryAutoEnabled && !primaryAutoAttempted) {
			const candidates = buildPrimaryAutoCandidates(ctx.cwd);
			let decision: PrimaryAutoDecision;
			try {
				if (ctx.hasUI) {
					ctx.ui.setWorkingMessage?.("Auto-Primary-Agent...");
					ctx.ui.setStatus?.("primary-auto", "Auto-Primary-Agent...");
				}
				const routed = await routePrimary({
					ctx,
					prompt: event.prompt,
					candidates,
					fallback: currentPrimary,
				});
				decision = normalizePrimaryAutoDecision(routed, candidates, currentPrimary);
			} catch (error) {
				console.error("primaryAuto route error:", error);
				decision = { selectedName: currentPrimary, source: "fallback" };
			} finally {
				if (ctx.hasUI) {
					ctx.ui.setWorkingMessage?.();
					ctx.ui.setStatus?.("primary-auto", undefined);
				}
			}

			primaryAutoAttempted = true;
			if (!ctx.hasUI) {
				ctx.ui.notify?.("Primary auto chooser requires interactive mode; keeping current primary", "warning");
				persistPrimaryAutoState({ ...decision, selectedName: currentPrimary, source: "fallback" });
			} else {
				const selectedName = await openSelectPalette(
					ctx,
					"Choose Primary Agent",
					"Top recommendation is marked with *",
					buildPrimaryAutoSelectorItems(candidates, decision),
				);
				if (selectedName) {
					currentPrimary = selectedName;
					setPrimaryAgent(pi, currentPrimary, { persistConfig: false, configPath: options.configPath });
					persistPrimaryAutoState({ ...decision, selectedName: currentPrimary });
				} else {
					persistPrimaryAutoState({ ...decision, selectedName: currentPrimary, source: "fallback" });
				}
			}
		}

		if (currentPrimary === SYSTEM_AGENT) return;

		try {
			const primary = findPrimaryAgent(ctx.cwd, currentPrimary, "both");
			if (!primary) {
				if (ctx.hasUI) ctx.ui.notify(`Primary agent not found: ${currentPrimary}, falling back to pi`, "warning");
				currentPrimary = SYSTEM_AGENT;
				return;
			}

			if (!primary.systemPrompt) return;
			return {
				systemPrompt: `${event.systemPrompt}

## Global User Instructions
Keep pi's built-in operational/tool instructions intact, but prioritize the following global behavior instructions loaded from \`${currentPrimary}\`.

${primary.systemPrompt}
`,
			};
		} catch (error) {
			console.error("before_agent_start error:", error);
			currentPrimary = SYSTEM_AGENT;
			return;
		}
	});

	pi.registerCommand("orgm-primary-agent", {
		description: "Open visual palette to select primary agent",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) {
				ctx.ui.notify("Visual selector requires interactive mode", "error");
				return;
			}

			const result = await openSelectPalette(
				ctx,
				"Select Primary Agent",
				`Active: ${formatPrimaryLabel(currentPrimary)}`,
				buildSelectorItems(currentPrimary, ctx.cwd),
			);

			if (result && result !== currentPrimary) {
				currentPrimary = result;
				setPrimaryAgent(pi, currentPrimary, { configPath: options.configPath });
				ctx.ui.notify(`Primary agent: ${formatPrimaryLabel(currentPrimary)}`, "success");
			} else if (result === currentPrimary) {
				ctx.ui.notify(`Already active: ${formatPrimaryLabel(currentPrimary)}`, "info");
			}
		},
	});

	pi.registerCommand("orgm-primary-auto", {
		description: "Set first-request automatic primary routing: true or false",
		getArgumentCompletions: (prefix) => {
			const value = prefix.trim().toLowerCase();
			return ["true", "false"]
				.filter((item) => !value || item.startsWith(value))
				.map((item) => ({ value: item, label: item }));
		},
		handler: async (args, ctx) => {
			const value = args.trim().toLowerCase();
			if (value !== "true" && value !== "false") {
				ctx.ui.notify(`Primary auto ${primaryAutoEnabled ? "enabled" : "disabled"}`, primaryAutoEnabled ? "info" : "warning");
				ctx.ui.notify("Usage: /orgm-primary-auto <true|false>", "info");
				return;
			}

			primaryAutoEnabled = value === "true";
			saveOrgmConfigSlice("primaryAuto", { enabled: primaryAutoEnabled }, options.configPath);
			ctx.ui.notify(`Primary auto ${primaryAutoEnabled ? "enabled" : "disabled"}`, primaryAutoEnabled ? "success" : "warning");
		},
	});

	pi.registerShortcut("alt+1", {
		description: "Open primary agent selector",
		handler: async (ctx) => {
			if (!ctx.hasUI) return;
			const result = await openSelectPalette(
				ctx,
				"Select Primary Agent",
				`Active: ${formatPrimaryLabel(currentPrimary)}`,
				buildSelectorItems(currentPrimary, ctx.cwd),
			);

			if (result && result !== currentPrimary) {
				currentPrimary = result;
				setPrimaryAgent(pi, currentPrimary, { configPath: options.configPath });
				ctx.ui.notify(`Primary agent: ${formatPrimaryLabel(currentPrimary)}`, "success");
			} else if (result === currentPrimary) {
				ctx.ui.notify(`Already active: ${formatPrimaryLabel(currentPrimary)}`, "info");
			}
		},
	});
}
