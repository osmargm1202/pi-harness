import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { visibleTasks, type TaskState } from "../extensions/todo.ts";
import { loadOrgmConfig } from "../extensions/lib/orgm-config.ts";
import { isOrgmExtensionEnabled } from "../extensions/lib/orgm-extension-config.ts";

const defaultConfig = loadOrgmConfig("/tmp/pi-harness-missing-orgm-config.json");
assert.equal(isOrgmExtensionEnabled("todo", defaultConfig), true, "todo extension should default on");

const state: TaskState = {
  nextId: 7,
  tasks: [
    { id: 4, subject: "done four", status: "completed" },
    { id: 3, subject: "pending three", status: "pending" },
    { id: 2, subject: "done two", status: "completed" },
    { id: 1, subject: "pending one", status: "pending" },
    { id: 6, subject: "deleted six", status: "deleted" },
    { id: 5, subject: "active five", status: "in_progress" },
  ],
};

assert.deepEqual(
  visibleTasks(state, true).map((task) => `${task.status}:${task.id}`),
  ["in_progress:5", "pending:1", "pending:3", "completed:2", "completed:4", "deleted:6"],
  "visible tasks should put active id first, then pending ids, completed ids, and deleted last when included",
);

const source = readFileSync("extensions/todo.ts", "utf8");
assert.match(
  source,
  /\["in_progress", "In Progress"\][\s\S]*\["pending", "Pending"\][\s\S]*\["completed", "Completed"\]/,
  "grouped todo notification should render in-progress, pending, then completed",
);
assert.match(source, /const OVERLAY_TASK_LIMIT = 5;/, "todo overlay should show at most 5 tasks");
assert.match(source, /renderTaskLines\(tasks, theme, expanded \? tasks\.length : 5\)/, "collapsed todo tool result should show at most 5 tasks");
