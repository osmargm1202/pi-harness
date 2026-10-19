import { constants, copyFileSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";

// pi-mcp-adapter owns MCP in this stack; do not also load Pi's built-in MCP extension.
export function configurePi({ dryRun = false, checkOnly = false } = {}) {
	const configured = process.env.PI_CODING_AGENT_DIR?.trim();
	const agentDir = configured ? path.resolve(configured) : path.join(homedir(), ".pi", "agent");
	const settingsPath = path.join(agentDir, "settings.json");
	let original;
	let current = {};
	try {
		if (lstatSync(settingsPath).isSymbolicLink()) throw new Error("settings.json es un enlace simbólico; cambia su origen gestionado");
		original = readFileSync(settingsPath, "utf8");
		current = JSON.parse(original);
		if (!current || typeof current !== "object" || Array.isArray(current)) throw new Error("settings.json debe ser un objeto JSON");
	} catch (error) {
		if (error.code !== "ENOENT") throw error;
	}
	if (current.extensions !== undefined && (!Array.isArray(current.extensions) || current.extensions.some((entry) => typeof entry !== "string"))) {
		throw new Error("settings.extensions debe ser una lista de strings");
	}
	const extensions = (current.extensions ?? []).filter((entry) => entry !== "+builtin:mcp" && entry !== "builtin:mcp");
	if (!extensions.includes("-builtin:mcp")) extensions.push("-builtin:mcp");
	const next = { ...current, extensions };
	if (checkOnly) return;
	console.log(`Pi: desactivar builtin:mcp para usar pi-mcp-adapter en ${settingsPath}`);
	if (dryRun) return;
	if (JSON.stringify(current.extensions) === JSON.stringify(extensions)) return;
	mkdirSync(agentDir, { recursive: true, mode: 0o700 });
	if (original !== undefined) {
		const backup = `${settingsPath}.backup-${randomUUID()}`;
		copyFileSync(settingsPath, backup, constants.COPYFILE_EXCL);
		console.log(`Copia de seguridad: ${backup}`);
	}
	const temporary = `${settingsPath}.tmp-${randomUUID()}`;
	try {
		writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, { flag: "wx", mode: 0o600 });
		renameSync(temporary, settingsPath);
	} finally {
		rmSync(temporary, { force: true });
	}
}
