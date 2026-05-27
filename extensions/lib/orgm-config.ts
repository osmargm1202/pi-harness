import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, normalize, resolve } from "node:path";

export type OrgmFlowName = "normal" | "pi-orchestrator" | "sdd-tdd" | string;

export interface OrgmGitConfig {
	autoInit: boolean;
	autoCommitCompletedWork: boolean;
	preferWorktreesForLongWork: boolean;
	ignoreRoots: string[];
}

export interface OrgmRepoTreeConfig {
	enabled: boolean;
	maxDepth: number;
}

export interface OrgmTitleConfig {
	autoGenerate: boolean;
}

export interface OrgmCavemanConfig {
	defaultLevel: string;
	showStatus: boolean;
	skillPath?: string;
}

export interface OrgmMinimalSkillsConfig {
	enabled: boolean;
}

export interface OrgmAgentStatusConfig {
	showWidget: boolean;
	showModel: boolean;
	showTokens: boolean;
	showCost: boolean;
	showPersistence: boolean;
	showSummary: boolean;
	showActivity: boolean;
	showCaveman: boolean;
}

export interface OrgmHostConfig {
	defaultPrimaryAgent: string;
	flows: Record<string, OrgmFlowName>;
	git: OrgmGitConfig;
	repoTree: OrgmRepoTreeConfig;
	title: OrgmTitleConfig;
	caveman: OrgmCavemanConfig;
	minimalSkills: OrgmMinimalSkillsConfig;
	agentStatus: OrgmAgentStatusConfig;
}

export const DEFAULT_ORGM_CONFIG: OrgmHostConfig = {
	defaultPrimaryAgent: "pi",
	flows: {
		pi: "normal",
		"pi-orchestrator": "pi-orchestrator",
		"sdd-orchestrator": "sdd-tdd",
	},
	git: {
		autoInit: false,
		autoCommitCompletedWork: false,
		preferWorktreesForLongWork: true,
		ignoreRoots: ["~", "~/Nextcloud", "~/Nextcloud/**"],
	},
	repoTree: {
		enabled: true,
		maxDepth: 3,
	},
	title: {
		autoGenerate: true,
	},
	caveman: {
		defaultLevel: "off",
		showStatus: true,
	},
	minimalSkills: {
		enabled: true,
	},
	agentStatus: {
		showWidget: true,
		showModel: true,
		showTokens: true,
		showCost: false,
		showPersistence: true,
		showSummary: true,
		showActivity: true,
		showCaveman: true,
	},
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeGitConfig(value: unknown): OrgmGitConfig {
	const raw = isRecord(value) ? value : {};
	return {
		autoInit: typeof raw.autoInit === "boolean" ? raw.autoInit : DEFAULT_ORGM_CONFIG.git.autoInit,
		autoCommitCompletedWork: typeof raw.autoCommitCompletedWork === "boolean"
			? raw.autoCommitCompletedWork
			: DEFAULT_ORGM_CONFIG.git.autoCommitCompletedWork,
		preferWorktreesForLongWork: typeof raw.preferWorktreesForLongWork === "boolean"
			? raw.preferWorktreesForLongWork
			: DEFAULT_ORGM_CONFIG.git.preferWorktreesForLongWork,
		ignoreRoots: Array.isArray(raw.ignoreRoots)
			? raw.ignoreRoots.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
			: [...DEFAULT_ORGM_CONFIG.git.ignoreRoots],
	};
}

function mergeRepoTreeConfig(value: unknown): OrgmRepoTreeConfig {
	const raw = isRecord(value) ? value : {};
	return {
		enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_ORGM_CONFIG.repoTree.enabled,
		maxDepth: typeof raw.maxDepth === "number" && Number.isInteger(raw.maxDepth) && raw.maxDepth >= 0
			? raw.maxDepth
			: DEFAULT_ORGM_CONFIG.repoTree.maxDepth,
	};
}

function mergeTitleConfig(value: unknown): OrgmTitleConfig {
	const raw = isRecord(value) ? value : {};
	return {
		autoGenerate: typeof raw.autoGenerate === "boolean" ? raw.autoGenerate : DEFAULT_ORGM_CONFIG.title.autoGenerate,
	};
}

export function mergeCavemanConfig(value: unknown): OrgmCavemanConfig {
	const raw = isRecord(value) ? value : {};
	return {
		defaultLevel: typeof raw.defaultLevel === "string" && raw.defaultLevel.trim()
			? raw.defaultLevel.trim()
			: DEFAULT_ORGM_CONFIG.caveman.defaultLevel,
		showStatus: typeof raw.showStatus === "boolean" ? raw.showStatus : DEFAULT_ORGM_CONFIG.caveman.showStatus,
		...(typeof raw.skillPath === "string" && raw.skillPath.trim() ? { skillPath: raw.skillPath.trim() } : {}),
	};
}

export function mergeMinimalSkillsConfig(value: unknown): OrgmMinimalSkillsConfig {
	const raw = isRecord(value) ? value : {};
	return {
		enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_ORGM_CONFIG.minimalSkills.enabled,
	};
}

export function mergeAgentStatusConfig(value: unknown): OrgmAgentStatusConfig {
	const raw = isRecord(value) ? value : {};
	return {
		showWidget: typeof raw.showWidget === "boolean" ? raw.showWidget : DEFAULT_ORGM_CONFIG.agentStatus.showWidget,
		showModel: typeof raw.showModel === "boolean" ? raw.showModel : DEFAULT_ORGM_CONFIG.agentStatus.showModel,
		showTokens: typeof raw.showTokens === "boolean" ? raw.showTokens : DEFAULT_ORGM_CONFIG.agentStatus.showTokens,
		showCost: typeof raw.showCost === "boolean" ? raw.showCost : DEFAULT_ORGM_CONFIG.agentStatus.showCost,
		showPersistence: typeof raw.showPersistence === "boolean" ? raw.showPersistence : DEFAULT_ORGM_CONFIG.agentStatus.showPersistence,
		showSummary: typeof raw.showSummary === "boolean" ? raw.showSummary : DEFAULT_ORGM_CONFIG.agentStatus.showSummary,
		showActivity: typeof raw.showActivity === "boolean" ? raw.showActivity : DEFAULT_ORGM_CONFIG.agentStatus.showActivity,
		showCaveman: typeof raw.showCaveman === "boolean" ? raw.showCaveman : DEFAULT_ORGM_CONFIG.agentStatus.showCaveman,
	};
}

const KNOWN_ORGM_CONFIG_KEYS = [
	"defaultPrimaryAgent",
	"flows",
	"git",
	"repoTree",
	"title",
	"caveman",
	"minimalSkills",
	"agentStatus",
] as const;

function preserveUnknownTopLevelValues(raw: Record<string, unknown>): Record<string, unknown> {
	const next: Record<string, unknown> = { ...raw };
	for (const key of KNOWN_ORGM_CONFIG_KEYS) delete next[key];
	return next;
}

function mergeOrgmConfig(raw: Record<string, unknown>): OrgmHostConfig {
	const flows = isRecord(raw.flows)
		? Object.fromEntries(Object.entries(raw.flows).filter(([, value]) => typeof value === "string") as Record<string, string>)
		: DEFAULT_ORGM_CONFIG.flows;
	const unknownTopLevel = preserveUnknownTopLevelValues(raw);
	return {
		...(unknownTopLevel as OrgmHostConfig),
		defaultPrimaryAgent: typeof raw.defaultPrimaryAgent === "string" && raw.defaultPrimaryAgent.trim()
			? raw.defaultPrimaryAgent.trim()
			: DEFAULT_ORGM_CONFIG.defaultPrimaryAgent,
		flows: { ...DEFAULT_ORGM_CONFIG.flows, ...flows },
		git: mergeGitConfig(raw.git),
		repoTree: mergeRepoTreeConfig(raw.repoTree),
		title: mergeTitleConfig(raw.title),
		caveman: mergeCavemanConfig(raw.caveman),
		minimalSkills: mergeMinimalSkillsConfig(raw.minimalSkills),
		agentStatus: mergeAgentStatusConfig(raw.agentStatus),
	};
}

export function expandHomePath(path: string, home = homedir()): string {
	if (path === "~") return home;
	if (path.startsWith("~/")) return join(home, path.slice(2));
	return path;
}

export function normalizeFsPath(path: string, base = process.cwd(), home = homedir()): string {
	const expanded = expandHomePath(path, home);
	return normalize(isAbsolute(expanded) ? expanded : resolve(base, expanded));
}

export function isBlockedGitRoot(cwd: string, ignoreRoots = DEFAULT_ORGM_CONFIG.git.ignoreRoots, home = homedir()): boolean {
	const current = normalizeFsPath(cwd, process.cwd(), home);
	for (const root of ignoreRoots) {
		const isGlobChildren = root.endsWith("/**");
		const withoutGlob = isGlobChildren ? root.slice(0, -3) : root;
		const normalizedRoot = normalizeFsPath(withoutGlob, process.cwd(), home);
		if (isGlobChildren) {
			if (current === normalizedRoot || current.startsWith(`${normalizedRoot}/`)) return true;
			continue;
		}
		if (current === normalizedRoot) return true;
	}
	return false;
}

export function orgmConfigPath(home = homedir()): string {
	return join(home, ".pi", "agent", "orgm.json");
}

export type OrgmConfigSliceKey = keyof OrgmHostConfig;
export type WritableOrgmConfigSliceKey = keyof Pick<OrgmHostConfig, "defaultPrimaryAgent" | "caveman" | "minimalSkills" | "agentStatus" | "repoTree" | "title">;

export function loadOrgmConfig(configPath = orgmConfigPath()): OrgmHostConfig {
	if (!existsSync(configPath)) return structuredClone(DEFAULT_ORGM_CONFIG);
	try {
		const raw = JSON.parse(readFileSync(configPath, "utf8"));
		if (!isRecord(raw)) return structuredClone(DEFAULT_ORGM_CONFIG);
		return mergeOrgmConfig(raw);
	} catch {
		return structuredClone(DEFAULT_ORGM_CONFIG);
	}
}

export function loadOrgmConfigSlice<K extends OrgmConfigSliceKey>(slice: K, configPath = orgmConfigPath()): OrgmHostConfig[K] {
	return structuredClone(loadOrgmConfig(configPath)[slice]);
}

export function saveOrgmConfigSlice<K extends WritableOrgmConfigSliceKey>(
	slice: K,
	value: OrgmHostConfig[K],
	configPath = orgmConfigPath(),
): void {
	let raw: Record<string, unknown> = {};
	try {
		const parsed = JSON.parse(readFileSync(configPath, "utf8"));
		if (isRecord(parsed)) raw = parsed;
	} catch {
		raw = {};
	}
	mkdirSync(dirname(configPath), { recursive: true });
	writeFileSync(configPath, `${JSON.stringify({ ...raw, [slice]: value }, null, 2)}\n`, "utf8");
}
