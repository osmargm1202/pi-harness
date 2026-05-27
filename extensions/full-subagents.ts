import { createRequire } from "node:module";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DEFAULT_FULL_SUBAGENTS_CONFIG, loadFullSubagentsConfig, type FullSubagentsConfig } from "./lib/full-subagents-config.ts";
import { syncFullSubagentOverrides, validateFullSubagentBackings } from "./lib/full-subagents-agent-sync.ts";
import {
	FullSubagentPool,
	createPiSubagentTransport,
	type FullSubagentSnapshot,
	type FullSubagentTeamResult,
	type FullSubagentTaskResult,
} from "./lib/full-subagents-com.ts";
import { clearFullSubagentsWidget, installFullSubagentsWidget } from "./lib/full-subagents-widget.ts";
import { orgmConfigPath, saveOrgmConfigSlice } from "./lib/orgm-config.ts";

const require = createRequire(import.meta.url);

export const FULL_SUBAGENT_TASK_TOOL = "full_subagent_task";
export const FULL_QUERY_TEAM_TOOL = "full_query_team";
const STRICT_PARENT_BLOCKED_TOOLS = new Set([
	"read",
	"bash",
	"edit",
	"write",
	"context_mode_ctx_execute",
	"context_mode_ctx_execute_file",
	"context_mode_ctx_batch_execute",
]);
export const STRICT_DELEGATION_SNIPPET = `You are the parent orchestrator for full-subagents.

STRICT FULL-SUBAGENTS MODE:
- Do not do meaningful work yourself: do not read project files, analyze code, design implementation details, write code, debug, review, or verify directly.
- Your job is communication and orchestration only: clarify with the user, choose the right full subagent, delegate, summarize returned results, and ask the next coordination question.
- Delegate all meaningful design, coding, review, debugging, research, and verification work to full_subagent_task or full_query_team.
- Use the agent whose .md role matches the work: planning/design to planners, implementation/code changes to implementers, review to reviewers, verification to verifiers.
- If no enabled full subagent fits the work, ask the user to enable/configure one instead of doing the work yourself.`;

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
	stopTask?(agent: string, reason: string): void;
	resetAgent?(agent: string): void;
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

function startupTeamMembers(config: FullSubagentsConfig): string[] {
	return (config.teams[config.startupTeam] ?? []).slice(0, config.maxAgents);
}

function defaultAgentConfig(): NonNullable<FullSubagentsConfig["agents"][string]> {
	return {
		tools: "inherit",
		skills: "inherit",
		mcp: "inherit",
		extensions: "inherit",
	};
}

function ensureStartupTeamAgents(config: FullSubagentsConfig): void {
	for (const agentName of startupTeamMembers(config)) {
		config.agents[agentName] ??= defaultAgentConfig();
	}
}

function defaultRuntimeFactory(config: FullSubagentsConfig, ctx: ExtensionContext): FullSubagentsRuntime | undefined {
	const members = startupTeamMembers(config);
	if (members.length === 0) return undefined;
	return new FullSubagentPool(members.map((agentName) => {
		const agent = config.agents[agentName] ?? defaultAgentConfig();
		const makeTransport = () => createPiSubagentTransport({
			agentName,
			model: agent.model,
			tools: listModeItems(agent.tools),
			cwd: ctx.cwd,
		});
		return {
			agentId: agentName,
			agentName,
			model: agent.model,
			transport: makeTransport(),
			createTransport: makeTransport,
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
	return startupTeamMembers(config).map((agentName) => ({
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

function envFlag(name: string): boolean {
	const value = process.env[name]?.trim().toLowerCase();
	return value === "1" || value === "true";
}

function isFullSubagentChildRuntime(): boolean {
	return envFlag("PI_FULL_SUBAGENT_CHILD") || envFlag("PI_SUBAGENT_CHILD");
}

function initFullSubagentsConfig(configPath: string): FullSubagentsConfig {
	const initialized = loadFullSubagentsConfig(configPath);
	ensureStartupTeamAgents(initialized);
	saveOrgmConfigSlice("fullSubagents", initialized, configPath);
	return initialized;
}

export default function registerFullSubagents(pi: ExtensionAPI, options: FullSubagentsRegisterOptions = {}) {
	let config = DEFAULT_FULL_SUBAGENTS_CONFIG;
	let snapshots: FullSubagentSnapshot[] = fallbackSnapshots(config);
	let pool: FullSubagentsRuntime | undefined;
	let lastSessionContext: ExtensionContext | undefined;

	const getSnapshots = () => pool?.getSnapshot() ?? snapshots;
	const createRuntime = (ctx: ExtensionContext) => {
		pool = (options.createRuntime ?? defaultRuntimeFactory)(config, ctx);
	};
	const resetRuntime = (ctx: ExtensionContext) => {
		pool?.shutdown();
		pool = undefined;
		if (config.enabled && !isFullSubagentChildRuntime()) createRuntime(ctx);
	};

	pi.on("session_start", async (_event: unknown, ctx: ExtensionContext) => {
		config = loadFullSubagentsConfig(options.configPath ?? orgmConfigPath());
		snapshots = fallbackSnapshots(config);
		pool?.shutdown();
		pool = undefined;
		if (isFullSubagentChildRuntime()) return;
		if (!config.enabled) return;
		ensureStartupTeamAgents(config);
		snapshots = fallbackSnapshots(config);
		const backingReport = validateFullSubagentBackings(config, { cwd: ctx.cwd, userAgentsDir: options.userAgentsDir });
		const syncReport = syncFullSubagentOverrides(config, { cwd: ctx.cwd, userAgentsDir: options.userAgentsDir });
		if (backingReport.missing.length > 0) {
			snapshots = backingReport.missing.map((agentName) => ({
				agentId: agentName,
				agentName,
				model: config.agents[agentName]?.model,
				state: "error",
				activity: "missing .md agent doc",
				contextTokens: 0,
				contextWindow: 0,
				contextPercent: 0,
				compactCount: 0,
				lastError: "missing backing .md agent document",
			}));
			if (ctx.hasUI) ctx.ui.notify(`Full subagents missing .md: ${backingReport.missing.join(", ")}`, "error");
			return;
		}
		lastSessionContext = ctx;
		createRuntime(ctx);
		if (ctx.hasUI) {
			installFullSubagentsWidget(ctx, getSnapshots, { showModel: true, showContext: true, showCompact: true, layout: config.widgetLayout });
			const syncedCount = syncReport.synced.length + syncReport.updated.length;
			const syncSuffix = syncedCount > 0 ? `, synced ${syncedCount} override(s)` : "";
			ctx.ui.notify(`Full subagents startup team: ${config.startupTeam} (${snapshots.length})${syncSuffix}`, "info");
		}
	});

	pi.on("before_agent_start", async (event: { systemPrompt?: string }) => {
		if (isFullSubagentChildRuntime()) return undefined;
		if (!config.strictDelegation) return undefined;
		const enabledAgents = startupTeamMembers(config);
		const agentList = enabledAgents.length > 0 ? `\n\nEnabled full subagents backed by .md docs: ${enabledAgents.join(", ")}.` : "";
		return { systemPrompt: `${event.systemPrompt ?? ""}\n\n${STRICT_DELEGATION_SNIPPET}${agentList}` };
	});

	pi.on("session_shutdown", async (_event: unknown, ctx: ExtensionContext) => {
		pool?.shutdown();
		pool = undefined;
		clearFullSubagentsWidget(ctx);
	});

	pi.on("tool_call", async (event: { toolName?: string }) => {
		if (!config.enabled || !config.strictDelegation || isFullSubagentChildRuntime()) return undefined;
		const toolName = String(event.toolName ?? "");
		if (!STRICT_PARENT_BLOCKED_TOOLS.has(toolName)) return undefined;
		return {
			block: true,
			reason: `Full-subagents strict mode blocks parent tool '${toolName}'. Delegate work to ${FULL_SUBAGENT_TASK_TOOL} or ${FULL_QUERY_TEAM_TOOL}.`,
		};
	});

	pi.registerCommand("orgm-full-subagents", {
		description: "Show full subagents status: /orgm-full-subagents [init|stop|continue|reset|restart <agent|all>]",
		handler: async (args: string, ctx: ExtensionContext) => {
			const trimmed = args.trim();
			const [command = "", target = "", ...rest] = trimmed.split(/\s+/);
			if (trimmed === "init") {
				config = initFullSubagentsConfig(options.configPath ?? orgmConfigPath());
				snapshots = fallbackSnapshots(config);
				if (ctx.hasUI) ctx.ui.notify("Initialized fullSubagents in orgm.json", "success");
				return;
			}
			if (command === "stop" && target) {
				const agents = target === "all" ? getSnapshots().map((snapshot) => snapshot.agentId) : [target];
				for (const agent of agents) pool?.stopTask?.(agent, "manual stop");
				if (ctx.hasUI) ctx.ui.notify(`Full subagents stopped: ${target}`, "warning");
				return;
			}
			if (command === "continue" && target && rest.length > 0) {
				const task = rest.join(" ");
				void pool?.runTask(target, task, ctx.cwd).catch((error) => {
					if (ctx.hasUI) ctx.ui.notify(`Full subagent continue failed: ${error instanceof Error ? error.message : String(error)}`, "error");
				});
				if (ctx.hasUI) ctx.ui.notify(`Full subagent continued: ${target}`, "info");
				return;
			}
			if ((command === "reset" || command === "restart") && target) {
				if (target === "all") resetRuntime(lastSessionContext ?? ctx);
				else pool?.resetAgent?.(target);
				if (ctx.hasUI) ctx.ui.notify(`Full subagents ${command}: ${target}`, "warning");
				return;
			}
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
