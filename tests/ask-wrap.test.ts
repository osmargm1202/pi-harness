import assert from "node:assert/strict";
import { visibleWidth } from "@earendil-works/pi-tui";
import { renderWrappedQuestion } from "../extensions/ask.ts";

const longQuestion = "¿Quieres que este título largo de ask_user_question se muestre completo en varias líneas sin cortar ni usar puntos suspensivos?";
const lines = renderWrappedQuestion(longQuestion, 34, (s) => s);

assert(lines.length > 1, "a long question should wrap across multiple lines");
assert(lines.join(" ").includes("puntos"), "wrapped question should preserve the full text instead of truncating with ellipsis");
assert(!lines.some((line) => line.includes("...")), "wrapped question should not use truncation ellipsis");
assert(lines.every((line) => visibleWidth(line) <= 34), "each wrapped line must fit within the render width");
