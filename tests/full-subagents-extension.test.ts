import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import registerFullSubagents, {
	FULL_SUBAGENT_TASK_TOOL,
	FULL_QUERY_TEAM_TOOL,
	STRICT_DELEGATION_SNIPPET,
	type FullSubagentsRuntime,
} from "../extensions/full-subagents.ts";

function createFakePi() {
	const handlers = new Map<string, Function[]>();
	const tools: any[] = [];
	const commands = new Map<string, any>();
	const activeTools: string[] = [];

	const fakePi: any = {
		on(event: string, handler: Function) {
			handlers.set(event, [...(handlers.get(event) ?? []), handler]);
		},
		registerTool(tool: any) {
			tools.push(tool);
		},
		registerCommand(name: string, command: any) {
			commands.set(name, command);
		},
		getActiveTools() {
			return activeTools;
		},
		setActiveTools(names: string[]) {
			activeTools.splice(0, activeTools.length, ...names);
		},
		events: { emit() {}, on() {} },
	};

	return { fakePi, handlers, tools, commands };
}

const { fakePi, handlers, tools, commands } = createFakePi();

registerFullSubagents(fakePi);

assert(tools.some((tool) => tool.name === FULL_SUBAGENT_TASK_TOOL));
assert(tools.some((tool) => tool.name === FULL_QUERY_TEAM_TOOL));
assert(commands.has("full-subagents"));

const beforeAgentStart = handlers.get("before_agent_start")?.[0];
assert(beforeAgentStart, "before_agent_start handler should be registered");

const result = await beforeAgentStart(
	{ systemPrompt: "base prompt" },
	{ cwd: process.cwd(), hasUI: false, ui: {}, sessionManager: { getSessionFile: () => undefined } },
);
assert(result.systemPrompt.includes("base prompt"));
assert(result.systemPrompt.includes(STRICT_DELEGATION_SNIPPET));

const taskTool = tools.find((tool) => tool.name === FULL_SUBAGENT_TASK_TOOL);
const taskResult = await taskTool.execute(
	"call-1",
	{ agent: "tdd-planner", task: "plan tests", cwd: process.cwd() },
	undefined,
	undefined,
	{ cwd: process.cwd(), hasUI: false, ui: {}, sessionManager: { getSessionFile: () => undefined } },
);
assert(taskResult.content[0].text.includes("queued"));
assert.match(taskResult.content[0].text, /no runtime pool/i);
assert.equal(taskResult.details.agent, "tdd-planner");
assert.equal(taskResult.details.requestId, "queued-without-runtime");
assert.equal(taskResult.details.runtimeAvailable, false);

const teamTool = tools.find((tool) => tool.name === FULL_QUERY_TEAM_TOOL);
const teamResult = await teamTool.execute(
	"call-2",
	{ team: "tdd-core", task: "review plan", execution: "parallel" },
	undefined,
	undefined,
	{ cwd: process.cwd(), hasUI: false, ui: {}, sessionManager: { getSessionFile: () => undefined } },
);
assert(teamResult.content[0].text.includes("tdd-core"));
assert.match(teamResult.content[0].text, /no runtime pool/i);
assert.equal(teamResult.details.team, "tdd-core");
assert.equal(teamResult.details.runtimeAvailable, false);

class FakeRuntime implements FullSubagentsRuntime {
	readonly tasks: Array<{ agent: string; task: string; cwd: string }> = [];
	readonly teams: Array<{ members: string[]; task: string; cwd: string; execution: "parallel" | "serial" }> = [];
	private snapshotAgents: string[];

	constructor(agentNames: string[]) {
		this.snapshotAgents = agentNames;
	}

	getSnapshot() {
		return this.snapshotAgents.map((agentName) => ({
			agentId: agentName,
			agentName,
			state: "idle" as const,
			activity: "idle",
			contextTokens: 0,
			contextWindow: 0,
			contextPercent: 0,
			compactCount: 0,
		}));
	}

	async runTask(agent: string, task: string, cwd: string) {
		this.tasks.push({ agent, task, cwd });
		return { requestId: `fake-${agent}`, text: `child result from ${agent}: ${task}` };
	}

	async runTeam(members: string[], task: string, cwd: string, execution: "parallel" | "serial") {
		this.teams.push({ members, task, cwd, execution });
		return {
			requestId: `team-${execution}`,
			text: `${execution} child results: ${members.join(",")} -> ${task}`,
			results: members.map((agent) => ({ agent, requestId: `fake-${agent}`, text: `done by ${agent}` })),
		};
	}

	shutdown() {}
}

const tempDir = mkdtempSync(join(tmpdir(), "full-subagents-extension-"));
try {
	const configPath = join(tempDir, "orgm.json");
	const projectRoot = join(tempDir, "project");
	const projectAgentsDir = join(projectRoot, ".pi", "agents", "sdd-orchestrator");
	const userAgentsDir = join(tempDir, "home", ".pi", "agent", "agents");
	mkdirSync(projectAgentsDir, { recursive: true });
	writeFileSync(
		join(projectAgentsDir, "alpha.md"),
		`---\nname: alpha\ndescription: Alpha agent\nmodel: stale/alpha\ntools: read, bash\n---\n\nAlpha body\n`,
		"utf8",
	);
	writeFileSync(
		configPath,
		JSON.stringify({
			fullSubagents: {
				enabled: true,
				startupTeam: "solo",
				maxAgents: 2,
				teams: { solo: ["alpha", "beta"] },
				agents: {
					alpha: { model: "test/alpha" },
					beta: { model: "test/beta" },
				},
			},
		}),
		"utf8",
	);

	const configured = createFakePi();
	let createdRuntime: FakeRuntime | undefined;
	registerFullSubagents(configured.fakePi, {
		configPath,
		userAgentsDir,
		createRuntime(config, ctx) {
			assert.equal(ctx.cwd, projectRoot);
			assert.equal(config.agents.alpha.model, "test/alpha");
			const startupMembers = config.teams[config.startupTeam] ?? [];
			createdRuntime = new FakeRuntime(startupMembers);
			return createdRuntime;
		},
	});

	await configured.handlers.get("session_start")?.[0](
		{},
		{ cwd: projectRoot, hasUI: false, ui: {}, sessionManager: { getSessionFile: () => undefined } },
	);
	assert(createdRuntime, "session_start should create a runtime when enabled configured agents exist");
	const syncedAgent = readFileSync(join(userAgentsDir, "sdd-orchestrator", "alpha.md"), "utf8");
	assert.match(syncedAgent, /^model: test\/alpha$/m);
	assert.match(syncedAgent, /Alpha body/);

	const configuredTaskTool = configured.tools.find((tool) => tool.name === FULL_SUBAGENT_TASK_TOOL);
	const routedTask = await configuredTaskTool.execute(
		"call-3",
		{ agent: "alpha", task: "implement slice" },
		undefined,
		undefined,
		{ cwd: "/repo", hasUI: false, ui: {}, sessionManager: { getSessionFile: () => undefined } },
	);
	assert.equal(routedTask.details.runtimeAvailable, true);
	assert.equal(routedTask.details.requestId, "fake-alpha");
	assert.equal(routedTask.details.result, "child result from alpha: implement slice");
	assert.equal(routedTask.content[0].text, "child result from alpha: implement slice");
	assert.deepEqual(createdRuntime.tasks, [{ agent: "alpha", task: "implement slice", cwd: "/repo" }]);

	const configuredTeamTool = configured.tools.find((tool) => tool.name === FULL_QUERY_TEAM_TOOL);
	const serialTeam = await configuredTeamTool.execute(
		"call-4",
		{ team: "solo", task: "review slice", execution: "serial" },
		undefined,
		undefined,
		{ cwd: "/repo", hasUI: false, ui: {}, sessionManager: { getSessionFile: () => undefined } },
	);
	assert.equal(serialTeam.details.runtimeAvailable, true);
	assert.equal(serialTeam.details.requestId, "team-serial");
	assert.equal(serialTeam.details.result, "serial child results: alpha,beta -> review slice");
	assert.deepEqual(createdRuntime.teams, [{ members: ["alpha", "beta"], task: "review slice", cwd: "/repo", execution: "serial" }]);
} finally {
	rmSync(tempDir, { recursive: true, force: true });
}
