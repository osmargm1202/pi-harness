import { createRequire } from "node:module";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DEFAULT_FULL_SUBAGENTS_CONFIG, loadFullSubagentsConfig, type FullSubagentsConfig } from "./lib/full-subagents-config.ts";
import { FullSubagentPool, type FullSubagentSnapshot } from "./lib/full-subagents-com.ts";
import { clearFullSubagentsWidget, installFullSubagentsWidget } from "./lib/full-subagents-widget.ts";
import { orgmConfigPath } from "./lib/orgm-config.ts";

const require = createRequire(import.meta.url);

export const FULL_SUBAGENT_TASK_TOOL = "full_subagent_task";
export const FULL_QUERY_TEAM_TOOL = "full_query_team";
export const STRICT_DELEGATION_SNIPPET = "You are the parent orchestrator for full-subagents. Delegate meaningful design, coding, review, debugging, and verification work to full_subagent_task or full_query_team. Answer directly only for clarification, coordination, brief summaries, or selecting the next delegation step.";

type SchemaFactory = {
	Object: (properties: Record<string, unknown>, options?: Record<string, unknown>) => Record<string, unknown>;
	String: (options?: Record<string, unknown>) => Record<string, unknown>;
	Optional: (schema: Record<string, unknown>) => Record<string, unknown>;
};

function fallbackTypebox(): SchemaFactory {
	return {
		Object: (properties, options = {}) => ({ type: "object", properties, ...options }),
		String: (options = {}) => ({ type: "string", ...options }),
		Optional: (schema) => ({ ...schema, optional: true }),
	};
}

function loadTypebox(): SchemaFactory {
	try {
		return (require("typebox") as { Type: SchemaFactory }).Type;
	} catch {
		return fallbackTypebox();
	}
}

function loadStringEnum(): (values: readonly string[], options?: Record<string, unknown>) => Record<string, unknown> {
	try {
		return (require("@earendil-works/pi-ai") as { StringEnum: (values: readonly string[], options?: Record<string, unknown>) => Record<string, unknown> }).StringEnum;
	} catch {
		return (values, options = {}) => ({ type: "string", enum: [...values], ...options });
	}
}

const Type = loadTypebox();
const StringEnum = loadStringEnum();

const TaskParams = Type.Object({
	agent: Type.String({ description: "Configured full subagent name" }),
	task: Type.String({ description: "Task to assign" }),
	cwd: Type.Optional(Type.String({ description: "Working directory for the subagent task" })),
});

const TeamParams = Type.Object({
	team: Type.String({ description: "Configured full subagent team" }),
	task: Type.String({ description: "Task to assign to the team" }),
	execution: Type.Optional(StringEnum(["parallel", "serial"] as const, { default: "parallel" })),
});

function fallbackSnapshots(config: FullSubagentsConfig): FullSubagentSnapshot[] {
	const members = config.teams[config.startupTeam] ?? [];
	return members.slice(0, config.maxAgents).map((agentName) => ({
		agentId: agentName,
		agentName,
		model: config.agents[agentName]?.model,
		state: "idle",
		activity: "configured",
		contextTokens: 0,
		contextWindow: 0,
		contextPercent: 0,
		compactCount: 0,
	}));
}

export default function registerFullSubagents(pi: ExtensionAPI) {
	let config = DEFAULT_FULL_SUBAGENTS_CONFIG;
	let snapshots: FullSubagentSnapshot[] = fallbackSnapshots(config);
	let pool: FullSubagentPool | undefined;

	const getSnapshots = () => pool?.getSnapshot() ?? snapshots;

	pi.on("session_start", async (_event: unknown, ctx: ExtensionContext) => {
		config = loadFullSubagentsConfig(orgmConfigPath());
		snapshots = fallbackSnapshots(config);
		if (!config.enabled) return;
		if (ctx.hasUI) {
			installFullSubagentsWidget(ctx, getSnapshots, { showModel: true, showContext: true, showCompact: true });
			ctx.ui.notify(`Full subagents startup team: ${config.startupTeam} (${snapshots.length})`, "info");
		}
	});

	pi.on("before_agent_start", async (event: { systemPrompt?: string }) => {
		if (!config.strictDelegation) return undefined;
		return { systemPrompt: `${event.systemPrompt ?? ""}\n\n${STRICT_DELEGATION_SNIPPET}` };
	});

	pi.on("session_shutdown", async (_event: unknown, ctx: ExtensionContext) => {
		pool?.shutdown();
		pool = undefined;
		clearFullSubagentsWidget(ctx);
	});

	pi.registerCommand("full-subagents", {
		description: "Show full subagents status: /full-subagents [restart <agent>|team <name>]",
		handler: async (args: string, ctx: ExtensionContext) => {
			const trimmed = args.trim();
			if (!ctx.hasUI) return;
			if (!trimmed) {
				ctx.ui.notify(`Full subagents: ${getSnapshots().length} configured`, "info");
				return;
			}
			ctx.ui.notify(`Full subagents command accepted: ${trimmed}`, "info");
		},
	});

	pi.registerTool({
		name: FULL_SUBAGENT_TASK_TOOL,
		label: "Full Subagent Task",
		description: "Assign a task to a persistent full Pi subagent from the configured pool.",
		promptSnippet: "Assign meaningful work to a persistent full Pi subagent.",
		promptGuidelines: ["Use full_subagent_task for meaningful work when strict full-subagents delegation is active."],
		parameters: TaskParams,
		async execute(_toolCallId: string, params: { agent: string; task: string; cwd?: string }, _signal: unknown, _onUpdate: unknown, ctx: ExtensionContext) {
			const cwd = params.cwd ?? ctx.cwd;
			const runtimeAvailable = Boolean(pool);
			const requestId = pool ? pool.startTask(params.agent, params.task, cwd) : "queued-without-runtime";
			const text = runtimeAvailable
				? `Task queued for ${params.agent}: ${params.task}`
				: `Task accepted and recorded as queued for ${params.agent}: ${params.task}. No runtime pool is wired yet.`;
			return {
				content: [{ type: "text", text }],
				details: { agent: params.agent, task: params.task, cwd, requestId, runtimeAvailable },
			};
		},
	});

	pi.registerTool({
		name: FULL_QUERY_TEAM_TOOL,
		label: "Full Query Team",
		description: "Assign work to a configured persistent full-subagents team.",
		promptSnippet: "Query a persistent full-subagents team in parallel or serial.",
		promptGuidelines: ["Use full_query_team when multiple full subagents should contribute to a task."],
		parameters: TeamParams,
		async execute(_toolCallId: string, params: { team: string; task: string; execution?: "parallel" | "serial" }) {
			const members = config.teams[params.team] ?? [];
			const runtimeAvailable = Boolean(pool);
			const text = runtimeAvailable
				? `Team work queued on the configured team surface for ${params.team} (${members.length} member(s)): ${params.task}`
				: `Team work queued on the configured team surface for ${params.team} (${members.length} member(s)): ${params.task}. No runtime pool is wired yet.`;
			return {
				content: [{ type: "text", text }],
				details: { team: params.team, task: params.task, execution: params.execution ?? "parallel", members, runtimeAvailable },
			};
		},
	});
}
