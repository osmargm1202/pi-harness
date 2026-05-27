import {
	loadOrgmConfigSlice,
	orgmConfigPath,
	saveOrgmConfigSlice,
	type OrgmReportConfig,
} from "./orgm-config.ts";

export interface ReportConfig extends OrgmReportConfig {}

export const REPORT_CONFIG_DEFAULTS: ReportConfig = {
	enabled: true,
	intervalMinutes: 10,
};

export function getReportConfigPath(): string {
	return orgmConfigPath();
}

export function loadReportConfig(configPath?: string): ReportConfig {
	return { ...loadOrgmConfigSlice("report", configPath) };
}

export function saveReportConfig(config: ReportConfig, configPath?: string): void {
	saveOrgmConfigSlice("report", config, configPath);
}
