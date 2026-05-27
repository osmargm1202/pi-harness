import assert from "node:assert/strict";
import { TODO_RESET_MARKER, isTodoResetInput, replayTodoStateFromEntries, type TaskState } from "../extensions/todo.ts";

function snapshot(tasks: TaskState["tasks"], nextId: number) {
	return { tasks, nextId };
}

function normalizedTask(task: TaskState["tasks"][number]) {
	return {
		blockedBy: undefined,
		metadata: undefined,
		...task,
	};
}

assert.equal(isTodoResetInput(TODO_RESET_MARKER), true);
assert.equal(isTodoResetInput(`  ${TODO_RESET_MARKER}  `), true);
assert.equal(isTodoResetInput(`${TODO_RESET_MARKER} extra`), false);
assert.equal(isTodoResetInput("not reset"), false);

assert.deepEqual(
	replayTodoStateFromEntries([
		{
			type: "message",
			message: {
				role: "toolResult",
				toolName: "todo",
				details: snapshot([{ id: 1, subject: "before", status: "pending" }], 2),
			},
		},
		{
			type: "custom",
			customType: "orgm-todos-reset",
			data: { marker: TODO_RESET_MARKER },
		},
		{
			type: "message",
			message: {
				role: "toolResult",
				toolName: "todo",
				details: snapshot([{ id: 1, subject: "after", status: "in_progress" }], 2),
			},
		},
	] as never[]),
	snapshot([normalizedTask({ id: 1, subject: "after", status: "in_progress" })], 2),
	"latest reset should drop older todo snapshots",
);

assert.deepEqual(
	replayTodoStateFromEntries([
		{
			type: "message",
			message: {
				role: "toolResult",
				toolName: "todo",
				details: snapshot([{ id: 1, subject: "before", status: "pending" }], 2),
			},
		},
		{
			type: "message",
			message: {
				role: "user",
				content: TODO_RESET_MARKER,
			},
		},
	] as never[]),
	{ tasks: [], nextId: 1 },
	"reset marker user message should rebuild empty todo state when no later snapshot exists",
);

const rebuilt = replayTodoStateFromEntries([
	{
		type: "message",
		message: {
			role: "toolResult",
			toolName: "todo",
			details: snapshot([{ id: 1, subject: "seed", status: "pending", blockedBy: [99], metadata: { lane: "x" } }], 2),
		},
	},
] as never[]);

rebuilt.tasks[0]!.subject = "mutated";
rebuilt.tasks[0]!.blockedBy?.push(100);
assert.deepEqual(
	replayTodoStateFromEntries([
		{
			type: "message",
			message: {
				role: "toolResult",
				toolName: "todo",
				details: snapshot([{ id: 1, subject: "seed", status: "pending", blockedBy: [99], metadata: { lane: "x" } }], 2),
			},
		},
	] as never[]),
	snapshot([normalizedTask({ id: 1, subject: "seed", status: "pending", blockedBy: [99], metadata: { lane: "x" } })], 2),
	"replayed state should stay cloned",
);
