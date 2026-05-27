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
} from "./lib/agent-discovery";
import { resolveConfiguredPrimary } from "./lib/orgm-flow";
import { saveOrgmConfigSlice } from "./lib/orgm-config";
import { createSelectPanel } from "./lib/tui-select-panel.ts";

const SUBAGENT_ENV_FLAG = "PI_PDD_SUBAGENT";
const IS_SUBAGENT_RUNTIME = process.env[SUBAGENT_ENV_FLAG] === "1";

interface SelectorItem extends SelectItem {
	description: string;
}

function setPrimaryAgent(pi: ExtensionAPI, name: string): void {
	pi.appendEntry(PRIMARY_STATE_ENTRY, { selectedName: name });
	saveOrgmConfigSlice("defaultPrimaryAgent", name);
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

export default function (pi: ExtensionAPI) {
	let currentPrimary = SYSTEM_AGENT;

	pi.on("session_start", async (_event, ctx) => {
		currentPrimary = resolveConfiguredPrimary(
			ctx.cwd,
			restorePrimaryState(ctx.sessionManager.getEntries(), ctx.cwd, "both"),
		);
		pi.events.emit(PRIMARY_STATE_EVENT, { selectedName: currentPrimary });
	});

	pi.on("before_agent_start", async (event, ctx) => {
		if (IS_SUBAGENT_RUNTIME) return;
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
				setPrimaryAgent(pi, currentPrimary);
				ctx.ui.notify(`Primary agent: ${formatPrimaryLabel(currentPrimary)}`, "success");
			} else if (result === currentPrimary) {
				ctx.ui.notify(`Already active: ${formatPrimaryLabel(currentPrimary)}`, "info");
			}
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
				setPrimaryAgent(pi, currentPrimary);
				ctx.ui.notify(`Primary agent: ${formatPrimaryLabel(currentPrimary)}`, "success");
			} else if (result === currentPrimary) {
				ctx.ui.notify(`Already active: ${formatPrimaryLabel(currentPrimary)}`, "info");
			}
		},
	});
}
