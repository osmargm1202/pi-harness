import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
	loadOrgmConfig,
	loadOrgmConfigSlice,
	saveOrgmConfigSlice,
} from "../extensions/lib/orgm-config.ts";
import {
	REPORT_CONFIG_DEFAULTS,
	getReportConfigPath,
	loadReportConfig,
	saveReportConfig,
} from "../extensions/lib/report-config.ts";

const tempDir = mkdtempSync(join(tmpdir(), "orgm-config-"));
const configPath = join(tempDir, "orgm.json");

try {
	assert.deepEqual(
		loadOrgmConfigSlice("report", configPath),
		REPORT_CONFIG_DEFAULTS,
		"report slice should default when orgm.json is missing",
	);
	assert.deepEqual(
		loadReportConfig(configPath),
		REPORT_CONFIG_DEFAULTS,
		"report config wrapper should default when orgm.json is missing",
	);
	assert.equal(getReportConfigPath(), join(process.env.HOME ?? "", ".pi", "agent", "orgm.json"));

	writeFileSync(configPath, JSON.stringify({
		defaultPrimaryAgent: "pi-orchestrator",
		repoTree: { enabled: false, maxDepth: 5 },
		title: { autoGenerate: false },
		caveman: { defaultLevel: "lite" },
		minimalSkills: { enabled: false },
		agentStatus: { showWidget: false },
		report: { enabled: false, intervalMinutes: 3 },
	}, null, 2), "utf8");

	const orgmConfig = loadOrgmConfig(configPath);
	assert.equal(orgmConfig.defaultPrimaryAgent, "pi-orchestrator", "defaultPrimaryAgent should load from central orgm.json");
	assert.equal(orgmConfig.repoTree.enabled, false, "repoTree.enabled should load from central orgm.json");
	assert.equal(orgmConfig.repoTree.maxDepth, 5, "repoTree.maxDepth should load from central orgm.json");
	assert.equal(orgmConfig.title.autoGenerate, false, "title.autoGenerate should load from central orgm.json");
	assert.equal(orgmConfig.caveman.defaultLevel, "lite", "caveman.defaultLevel should load from central orgm.json");
	assert.equal(orgmConfig.minimalSkills.enabled, false, "minimalSkills.enabled should load from central orgm.json");
	assert.equal(orgmConfig.agentStatus.showWidget, false, "agentStatus.showWidget should load from central orgm.json");
	assert.deepEqual(
		loadOrgmConfigSlice("report", configPath),
		{ enabled: false, intervalMinutes: 3 },
		"report slice should load from central orgm.json",
	);
	assert.deepEqual(
		loadReportConfig(configPath),
		{ enabled: false, intervalMinutes: 3 },
		"report config wrapper should load from central orgm.json",
	);

	writeFileSync(configPath, JSON.stringify({
		report: { enabled: "no", intervalMinutes: 0 },
	}, null, 2), "utf8");
	assert.deepEqual(
		loadReportConfig(configPath),
		REPORT_CONFIG_DEFAULTS,
		"invalid report config should fall back to defaults",
	);

	saveOrgmConfigSlice("defaultPrimaryAgent", "pi", configPath);
	saveOrgmConfigSlice("title", { autoGenerate: true }, configPath);
	saveOrgmConfigSlice("report", { enabled: true, intervalMinutes: 15 }, configPath);
	const savedConfig = loadOrgmConfig(configPath);
	assert.equal(savedConfig.defaultPrimaryAgent, "pi", "defaultPrimaryAgent should persist through saveOrgmConfigSlice");
	assert.equal(savedConfig.title.autoGenerate, true, "title config should persist through saveOrgmConfigSlice");
	assert.deepEqual(
		savedConfig.report,
		{ enabled: true, intervalMinutes: 15 },
		"report slice should persist through saveOrgmConfigSlice",
	);

	saveReportConfig({ enabled: false, intervalMinutes: 12 }, configPath);
	assert.deepEqual(
		loadReportConfig(configPath),
		{ enabled: false, intervalMinutes: 12 },
		"report config wrapper should persist through saveReportConfig",
	);
} finally {
	rmSync(tempDir, { recursive: true, force: true });
}
