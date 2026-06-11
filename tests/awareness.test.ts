import assert from "node:assert/strict";
import { buildAwarenessText, renderAwarenessContent } from "../extensions/awareness.ts";

const content = await buildAwarenessText({ cwd: process.cwd() });

assert(content.includes("===== CONTEXTO GENERAL ====="), "awareness keeps general context");
assert(content.includes("===== PROYECTO ====="), "awareness keeps project context");
assert(content.includes("===== GIT ====="), "awareness keeps git context");
assert(!content.includes("===== SHELLS Y HERRAMIENTAS ====="), "awareness omits tool paths");
assert(!content.includes("===== CONTENEDORES ====="), "awareness omits container inventory");
assert(!content.includes("Toolbox"), "awareness omits toolbox detail");
assert(!content.includes("===== SISTEMA OPERATIVO ====="), "awareness omits OS detail");

for (const removedSection of [
	"===== VERSIONES =====",
	"===== TMUX =====",
	"===== ARCHIVOS CLAVE =====",
	"===== VARIABLES RELEVANTES =====",
	"===== BINARIOS DISPONIBLES =====",
]) {
	assert(!content.includes(removedSection), `awareness omits noisy section ${removedSection}`);
}

const collapsed = renderAwarenessContent(content, false);
assert.equal(collapsed, "awareness", "collapsed awareness renders as a compact one-line label");

const expanded = renderAwarenessContent(content, true);
assert(expanded.startsWith("awareness\n"), "expanded awareness keeps label header");
assert(expanded.includes("===== CONTEXTO GENERAL ====="), "expanded awareness includes full content");
