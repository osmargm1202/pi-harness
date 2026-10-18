import { constants, copyFileSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import path from "node:path";

/** Installation-time policy only; message delivery and agent lifecycle belong to pi-intercom. */
export function configureIntercom({ dryRun = false } = {}) {
	// Match pi-intercom/broker/paths.ts, including relative env overrides.
	const configured = process.env.PI_CODING_AGENT_DIR?.trim();
	const agentDir = configured ? path.resolve(configured) : path.join(homedir(), ".pi", "agent");
	const configDir = path.join(agentDir, "intercom");
	const configPath = path.join(configDir, "config.json");
	let original;
	let current = {};
	try {
		if (lstatSync(configPath).isSymbolicLink()) {
			throw new Error("config.json es un enlace simbólico; cambia la configuración en su origen gestionado");
		}
		original = readFileSync(configPath, "utf8");
		current = JSON.parse(original);
		if (!current || typeof current !== "object" || Array.isArray(current)) {
			throw new Error("la configuración debe ser un objeto JSON");
		}
	} catch (error) {
		if (error.code !== "ENOENT") throw new Error(`No se pudo leer ${configPath}: ${error.message}`);
	}

	const next = { enabled: true, inboundTrigger: "always", busyDelivery: "human-first", replyHint: true, ...current };
	next.enabled = true;
	next.inboundTrigger = "always";
	next.busyDelivery = "human-first";
	const changed = Object.keys(next).some((key) => next[key] !== current[key]);
	console.log(`Intercom: ${configPath}`);
	if (dryRun) {
		console.log(`Vista previa (sin escribir):\n${JSON.stringify(next, null, 2)}`);
	} else if (changed) {
		mkdirSync(configDir, { recursive: true, mode: 0o700 });
		if (original !== undefined) {
			const backupPath = `${configPath}.backup-${randomUUID()}`;
			copyFileSync(configPath, backupPath, constants.COPYFILE_EXCL);
			console.log(`Copia de seguridad: ${backupPath}`);
		}
		const temporaryPath = `${configPath}.tmp-${randomUUID()}`;
		try {
			writeFileSync(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, { flag: "wx", mode: 0o600 });
			renameSync(temporaryPath, configPath);
		} finally {
			rmSync(temporaryPath, { force: true });
		}
		console.log("Configuración guardada: los mensajes nuevos pueden iniciar un turno; prioridad humana al estar ocupado.");
	} else {
		console.log("Intercom ya tiene la configuración solicitada; sin cambios.");
	}
	console.log("Ejecuta /reload o reinicia Pi en cada sesión receptora para cargar esta configuración.");
}
