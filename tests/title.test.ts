import assert from "node:assert/strict";
import { parseTitleCommand, renderTitleLine, sanitizeTitle } from "../extensions/lib/minimal-title.ts";

assert.equal(sanitizeTitle("  Diseño   extensión title.ts!!  "), "Diseño extensión title.ts!!");
assert.equal(sanitizeTitle(""), "");
assert.equal(sanitizeTitle("a".repeat(100), 20), `${"a".repeat(19)}…`);

assert.deepEqual(parseTitleCommand(""), { action: "show" });
assert.deepEqual(parseTitleCommand("regen"), { action: "regen" });
assert.deepEqual(parseTitleCommand("name Sesión manual"), { action: "name", title: "Sesión manual" });
assert.deepEqual(parseTitleCommand('name "Sesión manual"'), { action: "name", title: "Sesión manual" });
assert.deepEqual(parseTitleCommand("clear"), { action: "clear" });
assert.equal(parseTitleCommand("wat").action, "unknown");

const ready = renderTitleLine({ state: "ready", title: "Mi sesión" }, 31, (kind, text) => text);
assert.equal(ready.length, 31, "ready title line should fill the full footer width");
assert(ready.includes("Mi sesión"), "ready title line should include the title");
assert.equal(ready.trim(), "Mi sesión", "ready title should be centered with surrounding space only");

const generating = renderTitleLine({ state: "generating", frame: "⠋" }, 24, (kind, text) => text);
assert.equal(generating.length, 24, "generating line should fill width");
assert(generating.includes("Generando título"), "generating line should show spinner message");

const error = renderTitleLine({ state: "error", error: "boom" }, 30, (kind, text) => text);
assert.equal(error.length, 30, "error line should fill width");
assert(error.includes("/orgm-title regen"), "error line should suggest regeneration command");
