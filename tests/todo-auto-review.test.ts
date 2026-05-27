import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("extensions/todo.ts", "utf8");

assert.doesNotMatch(
	source,
	/sendUserMessage\([^\n]+deliverAs:\s*["']followUp["']/,
	"todo extension must not enqueue an automatic follow-up turn",
);
assert.doesNotMatch(
	source,
	/AUTO_REVIEW_PROMPT/,
	"todo extension should not keep auto-review prompt machinery",
);
