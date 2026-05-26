import assert from "node:assert/strict";
import { visibleWidth } from "@earendil-works/pi-tui";
import { renderWrappedDescription, renderWrappedQuestion } from "../extensions/ask.ts";

const longQuestion = "¿Quieres que este título largo de ask_user_question se muestre completo en varias líneas sin cortar ni usar puntos suspensivos?";
const lines = renderWrappedQuestion(longQuestion, 34, (s) => s);

assert(lines.length > 1, "a long question should wrap across multiple lines");
assert(lines.join(" ").includes("puntos"), "wrapped question should preserve the full text instead of truncating with ellipsis");
assert(!lines.some((line) => line.includes("...")), "wrapped question should not use truncation ellipsis");
assert(lines.every((line) => visibleWidth(line) <= 34), "each wrapped line must fit within the render width");

const longDescription = "Explicación larga de una opción que necesita mostrarse completa en varias líneas y no terminar recortada con puntos suspensivos.";
const descriptionLines = renderWrappedDescription(longDescription, 34, (s) => s);

assert(descriptionLines.length > 1, "a long option description should wrap across multiple lines");
assert(descriptionLines.join(" ").includes("puntos"), "wrapped description should preserve the full text instead of truncating with ellipsis");
assert(!descriptionLines.some((line) => line.includes("...")), "wrapped description should not use truncation ellipsis");
assert(descriptionLines.every((line) => line.startsWith("     ")), "description lines should keep the existing option indentation");
assert(descriptionLines.every((line) => visibleWidth(line) <= 34), "each wrapped description line must fit within the render width");
