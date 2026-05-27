import assert from "node:assert/strict";
import { isSpecApprovalKey } from "../extensions/spec-dis.ts";

assert.equal(isSpecApprovalKey("\r"), false, "Enter should not approve the open spec document");
assert.equal(isSpecApprovalKey("\u001B"), false, "Esc should not approve; it only closes the viewer");
