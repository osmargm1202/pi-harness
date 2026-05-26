import assert from "node:assert/strict";
import registerFullSubagents, {
	FULL_SUBAGENT_TASK_TOOL,
	FULL_QUERY_TEAM_TOOL,
	STRICT_DELEGATION_SNIPPET,
} from "../extensions/full-subagents.ts";

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
