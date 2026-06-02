import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isOrgmExtensionEnabled } from "./lib/orgm-extension-config.ts";

export default function (pi: ExtensionAPI) {
	if (!isOrgmExtensionEnabled("clear")) return;

	pi.registerCommand("orgm-clear", {
		description: "Start a fresh recoverable session in the current working directory",
		handler: async (_args, ctx) => {
			await ctx.waitForIdle();

			const currentSessionFile = ctx.sessionManager.getSessionFile();
			const successMessage = currentSessionFile
				? "Started a fresh session. Previous session preserved for /orgm-sessions recovery."
				: "Started a fresh session";
			const result = await ctx.newSession({
				parentSession: currentSessionFile,
				withSession: async (replacementCtx) => {
					replacementCtx.ui.notify(successMessage, "success");
				},
			});
			if (result.cancelled) {
				ctx.ui.notify("Clear cancelled", "info");
			}
		},
	});
}
