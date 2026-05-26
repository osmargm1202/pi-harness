import { loadOrgmConfig, orgmConfigPath, saveOrgmConfigSlice } from "./orgm-config";

export interface AgentStatusConfig {
	showWidget: boolean;
	showModel: boolean;
	showTokens: boolean;
	showCost: boolean;
	showPersistence: boolean;
	showSummary: boolean;
	showActivity: boolean;
	showCaveman: boolean;
}

export const AGENT_STATUS_CONFIG_DEFAULTS: AgentStatusConfig = {
	showWidget: true,
	showModel: true,
	showTokens: true,
	showCost: false,
	showPersistence: true,
	showSummary: true,
	showActivity: true,
	showCaveman: true,
};

export function getAgentStatusConfigPath(): string {
	return orgmConfigPath();
}

export function loadAgentStatusConfig(configPath?: string): AgentStatusConfig {
	return { ...loadOrgmConfig(configPath).agentStatus };
}

export function saveAgentStatusConfig(config: AgentStatusConfig, configPath?: string): void {
	saveOrgmConfigSlice("agentStatus", config, configPath);
}
