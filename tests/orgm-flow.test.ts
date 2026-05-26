import assert from "node:assert/strict";
import { resolveConfiguredPrimary } from "../extensions/lib/orgm-flow.ts";

assert.equal(
	resolveConfiguredPrimary(process.cwd(), "pi", {
		defaultPrimaryAgent: "pi-orchestrator",
		flows: {},
	}),
	"pi-orchestrator",
	"configured package-bundled primary agent should resolve without copying to ~/.pi/agent/agents",
);

assert.equal(
	resolveConfiguredPrimary(process.cwd(), "pi", {
		defaultPrimaryAgent: "missing-primary-agent",
		flows: {},
	}),
	"pi",
	"missing configured primary agent should fall back to pi",
);
