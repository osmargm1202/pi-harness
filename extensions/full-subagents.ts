import { createRequire } from "node:module";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DEFAULT_FULL_SUBAGENTS_CONFIG, loadFullSubagentsConfig, type FullSubagentsConfig } from "./lib/full-subagents-config.ts";
import { syncFullSubagentOverrides } from "./lib/full-subagents-agent-sync.ts";
import {
	FullSubagentPool,
	createPiSubagentTransport,
	type FullSubagentSnapshot,
	type FullSubagentTeamResult,
	type FullSubagentTaskResult,
} from "./lib/full-subagents-com.ts";
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

export interface FullSubagentsRuntime {
	getSnapshot(): FullSubagentSnapshot[];
	runTask(agent: string, task: string, cwd: string): Promise<FullSubagentTaskResult>;
	runTeam?(members: string[], task: string, cwd: string, execution: "parallel" | "serial"): Promise<FullSubagentTeamResult>;
	shutdown(): void;
}

export interface FullSubagentsRegisterOptions {
	configPath?: string;
	userAgentsDir?: string;
	createRuntime?: (config: FullSubagentsConfig, ctx: ExtensionContext) => FullSubagentsRuntime | undefined;
}

function listModeItems(value: FullSubagentsConfig["agents"][string]["tools"]): string[] {
	return Array.isArray(value) ? value : [];
}

function defaultRuntimeFactory(config: FullSubagentsConfig, ctx: ExtensionContext): FullSubagentsRuntime | undefined {
	const members = config.teams[config.startupTeam] ?? [];
	const configuredMembers = members
		.filter((agentName) => Boolean(config.agents[agentName]))
		.slice(0, config.maxAgents);
	if (configuredMembers.length === 0) return undefined;
	return new FullSubagentPool(configuredMembers.map((agentName) => {
		const agent = config.agents[agentName];
		return {
			agentId: agentName,
			agentName,
			model: agent.model,
			transport: createPiSubagentTransport({
				agentName,
				model: agent.model,
				tools: listModeItems(agent.tools),
				cwd: ctx.cwd,
			}),
		};
	}));
}

async function runTeamThroughRuntime(
	runtime: FullSubagentsRuntime,
	members: string[],
	task: string,
	cwd: string,
	execution: "parallel" | "serial",
): Promise<FullSubagentTeamResult> {
	const results: Array<FullSubagentTaskResult & { agent: string }> = [];
	if (execution === "serial") {
		for (const agent of members) {
			results.push({ agent, ...(await runtime.runTask(agent, task, cwd)) });
		}
	} else {
		results.push(...await Promise.all(members.map(async (agent) => ({ agent, ...(await runtime.runTask(agent, task, cwd)) }))));
	}
	return {
		requestId: results.map((result) => result.requestId).join(","),
		text: results.map((result) => `${result.agent}: ${result.text}`).join("\n"),
		results,
	};
}

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

export default function registerFullSubagents(pi: ExtensionAPI, options: FullSubagentsRegisterOptions = {}) {
	let config = DEFAULT_FULL_SUBAGENTS_CONFIG;
	let snapshots: FullSubagentSnapshot[] = fallbackSnapshots(config);
	let pool: FullSubagentsRuntime | undefined;

	const getSnapshots = () => pool?.getSnapshot() ?? snapshots;

	pi.on("session_start", async (_event: unknown, ctx: ExtensionContext) => {
		config = loadFullSubagentsConfig(options.configPath ?? orgmConfigPath());
		snapshots = fallbackSnapshots(config);
		pool?.shutdown();
		pool = undefined;
		const syncReport = syncFullSubagentOverrides(config, { cwd: ctx.cwd, userAgentsDir: options.userAgentsDir });
		if (!config.enabled) return;
		pool = (options.createRuntime ?? defaultRuntimeFactory)(config, ctx);
		if (ctx.hasUI) {
			installFullSubagentsWidget(ctx, getSnapshots, { showModel: true, showContext: true, showCompact: true });
			const syncedCount = syncReport.synced.length + syncReport.updated.length;
			const syncSuffix = syncedCount > 0 ? `, synced ${syncedCount} override(s)` : "";
			ctx.ui.notify(`Full subagents startup team: ${config.startupTeam} (${snapshots.length})${syncSuffix}`, "info");
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
			if (pool) {
				const result = await pool.runTask(params.agent, params.task, cwd);
				return {
					content: [{ type: "text", text: result.text }],
					details: { agent: params.agent, task: params.task, cwd, requestId: result.requestId, result: result.text, runtimeAvailable: true },
				};
			}
			const text = `Task accepted and recorded as queued for ${params.agent}: ${params.task}. No runtime pool is wired yet.`;
			return {
				content: [{ type: "text", text }],
				details: { agent: params.agent, task: params.task, cwd, requestId: "queued-without-runtime", runtimeAvailable: false },
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
		async execute(_toolCallId: string, params: { team: string; task: string; execution?: "parallel" | "serial" }, _signal: unknown, _onUpdate: unknown, ctx: ExtensionContext) {
			const members = config.teams[params.team] ?? [];
			const execution = params.execution ?? "parallel";
			if (pool) {
				const result = pool.runTeam
					? await pool.runTeam(members, params.task, ctx.cwd, execution)
					: await runTeamThroughRuntime(pool, members, params.task, ctx.cwd, execution);
				return {
					content: [{ type: "text", text: result.text }],
					details: { team: params.team, task: params.task, execution, members, requestId: result.requestId, result: result.text, results: result.results, runtimeAvailable: true },
				};
			}
			const text = `Team work queued on the configured team surface for ${params.team} (${members.length} member(s)): ${params.task}. No runtime pool is wired yet.`;
			return {
				content: [{ type: "text", text }],
				details: { team: params.team, task: params.task, execution, members, runtimeAvailable: false },
			};
		},
	});
}
