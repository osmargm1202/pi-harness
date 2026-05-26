import type { ExtensionAPI, ExtensionContext, SessionStartEvent } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { loadOrgmConfig, saveOrgmConfigSlice } from "./lib/orgm-config.ts";
import { buildProjectTreeText } from "./lib/repo-tree.ts";

const CUSTOM_TYPE = "repo-tree";

export interface RepoTreeExtensionOptions {
	home?: string;
	configPath?: string;
	maxDepth?: number;
}

function hasCustomRepoTree(entries: unknown[]): boolean {
	return entries.some((entry) => typeof entry === "object" && entry !== null && "customType" in entry && entry.customType === CUSTOM_TYPE);
}

function hasConversationEntries(entries: unknown[]): boolean {
	return entries.some((entry) => {
		if (typeof entry !== "object" || entry === null || !("type" in entry) || entry.type !== "message") return false;
		const message = "message" in entry ? entry.message : undefined;
		if (typeof message !== "object" || message === null || !("role" in message)) return false;
		return ["user", "assistant", "toolResult"].includes(String(message.role));
	});
}

function shouldInjectRepoTree(reason: SessionStartEvent["reason"], ctx: ExtensionContext, alreadySent: boolean): boolean {
	if (alreadySent) return false;
	const entries = ctx.sessionManager.getEntries();
	if (hasCustomRepoTree(entries)) return false;
	if (reason === "new") return true;
	if (reason === "startup") return !hasConversationEntries(entries);
	return false;
}

function configuredRepoTree(options: RepoTreeExtensionOptions) {
	const config = loadOrgmConfig(options.configPath).repoTree;
	return {
		enabled: config.enabled,
		maxDepth: typeof options.maxDepth === "number" ? options.maxDepth : config.maxDepth,
	};
}

function configuredMaxDepth(options: RepoTreeExtensionOptions): number {
	return configuredRepoTree(options).maxDepth;
}

export function buildRepoTreeMessageContent(
	ctx: Pick<ExtensionContext, "cwd">,
	options: RepoTreeExtensionOptions = {},
): string {
	return buildProjectTreeText(ctx.cwd, {
		home: options.home,
		maxDepth: configuredMaxDepth(options),
	});
}

export function renderRepoTreeContent(content: string, expanded: boolean): string {
	if (!expanded) return CUSTOM_TYPE;
	return `${CUSTOM_TYPE}\n${content}`;
}

export default function repoIndexExtension(pi: ExtensionAPI, options: RepoTreeExtensionOptions = {}) {
	let injectedThisLifecycle = false;

	pi.registerMessageRenderer(CUSTOM_TYPE, (message, rendererOptions, theme) => {
		return new Text(theme.fg("muted", renderRepoTreeContent(String(message.content ?? ""), rendererOptions.expanded)), 0, 0);
	});

	pi.on("session_start", async (event, ctx) => {
		if (!configuredRepoTree(options).enabled) return;
		if (!shouldInjectRepoTree(event.reason, ctx, injectedThisLifecycle)) return;
		const content = buildRepoTreeMessageContent(ctx, options);
		if (!content) return;
		injectedThisLifecycle = true;
		pi.sendMessage(
			{
				customType: CUSTOM_TYPE,
				content,
				display: true,
				details: { source: "startup-repo-tree" },
			},
			{ deliverAs: "nextTurn" },
		);
	});

	pi.registerCommand("orgm-repo-tree", {
		description: "Show/manage project tree context: /orgm-repo-tree [on|off|depth <n>]",
		handler: async (args, ctx) => {
			const parts = args.trim().toLowerCase().split(/\s+/).filter(Boolean);
			const current = configuredRepoTree(options);
			if (parts[0] === "on" || parts[0] === "off") {
				saveOrgmConfigSlice("repoTree", { ...current, enabled: parts[0] === "on" }, options.configPath);
				ctx.ui.notify(`repo-tree ${parts[0]}`, parts[0] === "on" ? "success" : "warning");
				return;
			}
			if (parts[0] === "depth" || parts[0] === "max-depth") {
				const maxDepth = Number.parseInt(parts[1] ?? "", 10);
				if (!Number.isInteger(maxDepth) || maxDepth < 0) {
					ctx.ui.notify("Usage: /orgm-repo-tree depth <0+>", "warning");
					return;
				}
				saveOrgmConfigSlice("repoTree", { ...current, maxDepth }, options.configPath);
				ctx.ui.notify(`repo-tree depth: ${maxDepth}`, "success");
				return;
			}
			if (parts.length > 0) {
				ctx.ui.notify("Usage: /orgm-repo-tree [on|off|depth <n>]", "warning");
				return;
			}
			const content = buildRepoTreeMessageContent(ctx, options);
			ctx.ui.notify(content || "repo-tree unavailable for this project root", content ? "info" : "warning");
		},
	});
}
