import assert from "node:assert/strict";
import { buildSpecApprovalMessage, isSpecApprovalKey } from "../extensions/spec-dis.ts";

assert.equal(
	buildSpecApprovalMessage({ relativePath: "docs/superpowers/specs/feature-design.md" }),
	"He aprobado este archivo: docs/superpowers/specs/feature-design.md",
	"approval message should include the selected document relative path",
);

assert.equal(isSpecApprovalKey("\r"), true, "Enter should approve the open spec document");
assert.equal(isSpecApprovalKey("\u001B"), false, "Esc should not approve; it only closes the viewer");
