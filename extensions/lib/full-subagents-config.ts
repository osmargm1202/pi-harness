import { existsSync, readFileSync } from "node:fs";

export type FullSubagentListMode = "inherit" | "all" | "none" | string[];

export interface FullSubagentAgentConfig {
	model?: string;
	tools: FullSubagentListMode;
	skills: FullSubagentListMode;
	mcp: FullSubagentListMode;
	extensions: FullSubagentListMode;
}

export type FullSubagentsWidgetLayout = "minimal" | "full";

export interface FullSubagentsConfig {
	enabled: boolean;
	strictDelegation: boolean;
	startupTeam: string;
	maxAgents: number;
	widgetLayout: FullSubagentsWidgetLayout;
	teams: Record<string, string[]>;
	agents: Record<string, FullSubagentAgentConfig>;
}

export const DEFAULT_TDD_CORE_TEAM = [
	"tdd-brainstormer",
	"tdd-planner",
	"tdd-implementer",
	"tdd-reviewer",
	"tdd-verifier",
] as const;

export const DEFAULT_FULL_SUBAGENTS_CONFIG: FullSubagentsConfig = {
	enabled: false,
	strictDelegation: true,
	startupTeam: "tdd-core",
	maxAgents: 5,
	widgetLayout: "minimal",
	teams: { "tdd-core": [...DEFAULT_TDD_CORE_TEAM] },
	agents: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanName(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function clampMaxAgents(value: unknown): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_FULL_SUBAGENTS_CONFIG.maxAgents;
	return Math.max(1, Math.min(10, Math.trunc(value)));
}

function cleanStringList(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return Array.from(
		new Set(value.map(cleanName).filter((item): item is string => Boolean(item))),
	);
}

function mergeListMode(value: unknown, fallback: FullSubagentListMode): FullSubagentListMode {
	if (value === "inherit" || value === "all" || value === "none") return value;
	if (Array.isArray(value)) return cleanStringList(value);
	return fallback;
}

function mergeAgentConfig(value: unknown): FullSubagentAgentConfig {
	const raw = isRecord(value) ? value : {};
	return {
		...(cleanName(raw.model) ? { model: cleanName(raw.model) } : {}),
		tools: mergeListMode(raw.tools, "inherit"),
		skills: mergeListMode(raw.skills, "inherit"),
		mcp: mergeListMode(raw.mcp, "inherit"),
		extensions: mergeListMode(raw.extensions, "inherit"),
	};
}

function mergeTeams(value: unknown): Record<string, string[]> {
	const merged: Record<string, string[]> = structuredClone(DEFAULT_FULL_SUBAGENTS_CONFIG.teams);
	if (!isRecord(value)) return merged;
	for (const [teamName, members] of Object.entries(value)) {
		const cleanTeamName = cleanName(teamName);
		const cleanMembers = cleanStringList(members);
		if (cleanTeamName && cleanMembers.length > 0) merged[cleanTeamName] = cleanMembers;
	}
	return merged;
}

function mergeWidgetLayout(value: unknown): FullSubagentsWidgetLayout {
	return value === "full" || value === "minimal" ? value : DEFAULT_FULL_SUBAGENTS_CONFIG.widgetLayout;
}

function mergeAgents(value: unknown): Record<string, FullSubagentAgentConfig> {
	const agents: Record<string, FullSubagentAgentConfig> = {};
	if (!isRecord(value)) return agents;
	for (const [name, config] of Object.entries(value)) {
		const cleanAgentName = cleanName(name);
		if (cleanAgentName) agents[cleanAgentName] = mergeAgentConfig(config);
	}
	return agents;
}

export function mergeFullSubagentsConfig(value: unknown): FullSubagentsConfig {
	const raw = isRecord(value) ? value : {};
	return {
		enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_FULL_SUBAGENTS_CONFIG.enabled,
		strictDelegation: typeof raw.strictDelegation === "boolean"
			? raw.strictDelegation
			: DEFAULT_FULL_SUBAGENTS_CONFIG.strictDelegation,
		startupTeam: cleanName(raw.startupTeam) ?? DEFAULT_FULL_SUBAGENTS_CONFIG.startupTeam,
		maxAgents: clampMaxAgents(raw.maxAgents),
		widgetLayout: mergeWidgetLayout(raw.widgetLayout),
		teams: mergeTeams(raw.teams),
		agents: mergeAgents(raw.agents),
	};
}

export function loadFullSubagentsConfig(configPath: string): FullSubagentsConfig {
	if (!existsSync(configPath)) return structuredClone(DEFAULT_FULL_SUBAGENTS_CONFIG);
	try {
		const parsed = JSON.parse(readFileSync(configPath, "utf8"));
		return mergeFullSubagentsConfig(isRecord(parsed) ? parsed.fullSubagents : undefined);
	} catch {
		return structuredClone(DEFAULT_FULL_SUBAGENTS_CONFIG);
	}
}
