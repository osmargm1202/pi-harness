#!/usr/bin/env node
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { configureIntercom } from "./configure-intercom.mjs";
import { configurePi } from "./configure-pi.mjs";
import { PACKAGES } from "./stack.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.join(ROOT, "..", "package.json");

let pkg;
try {
	const raw = readFileSync(packagePath, "utf8");
	pkg = JSON.parse(raw);
} catch (error) {
	console.error(`No se pudo leer package.json: ${String(error)}`);
	process.exit(1);
}

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run") || args.has("-d");
const setup = args.has("--setup");
const knownArgs = new Set(["--dry-run", "-d", "--setup", "--configure-intercom", "--postinstall", "--force", "--help", "-h"]);
for (const arg of args) {
	if (!knownArgs.has(arg)) {
		console.error(`Opción desconocida: ${arg}`);
		process.exit(1);
	}
}
// Preserve relative config paths even though pi install runs outside the caller's project.
if (process.env.PI_CODING_AGENT_DIR?.trim()) {
	process.env.PI_CODING_AGENT_DIR = path.resolve(process.env.PI_CODING_AGENT_DIR.trim());
}
const isPostinstall = args.has("--postinstall");
const forcePostinstall = isPostinstall && args.has("--force");
const canAutoInstall =
	!isPostinstall ||
	process.env.npm_config_global === "true" ||
	forcePostinstall;

if (args.has("--help") || args.has("-h")) {
	console.log(`Uso: pi-harness [--dry-run]
     pi-harness --setup [--dry-run]
     pi-harness --configure-intercom [--dry-run]

Sin opciones: instala los paquetes fijados en scripts/stack.mjs.
--setup: instala el stack, evita MCP duplicado y configura Intercom automáticamente.
--configure-intercom: configura únicamente Intercom (no instala paquetes).
  Habilita turnos con mensajes nuevos y prioridad humana al estar ocupado.
  Puede generar llamadas al modelo y consumo de tokens al recibir mensajes.
  Conserva otras opciones y crea una copia de seguridad antes de cambiar el archivo.
--dry-run, -d: muestra lo que se haría sin escribir ni instalar.
--help, -h: muestra esta ayuda.`);
	process.exit(0);
}

if (setup && (isPostinstall || args.has("--configure-intercom"))) {
	console.error("--setup es explícito y no se combina con --postinstall ni --configure-intercom.");
	process.exit(1);
}

if (args.has("--configure-intercom")) {
	if (isPostinstall) {
		console.error("--configure-intercom requiere ejecución explícita; no se admite en postinstall.");
		process.exit(1);
	}
	try {
		configureIntercom({ dryRun });
	} catch (error) {
		console.error(`No se pudo configurar Intercom: ${error.message}`);
		process.exit(1);
	}
	process.exit(0);
}

const candidates = [...new Set(PACKAGES)];

if (candidates.length === 0) {
	console.error("No se detectaron paquetes instalables en la lista interna.");
	process.exit(1);
}

if (isPostinstall && !canAutoInstall) {
	console.log(
		"Postinstall sin instalación global; usa npm run install:orgm-pi o ejecuta manualmente.",
	);
	process.exit(0);
}

if (!pkg?.scripts || typeof pkg.scripts?.["install:orgm-pi"] !== "string") {
	console.error("Script install:orgm-pi faltante en package.json.");
	process.exit(1);
}

console.log("Instalando paquetes definidos por este instalador...");
let installDir;
try {
	if (setup) {
		// Fail before pi install can touch a malformed or externally managed configuration.
		configurePi({ checkOnly: true });
		configureIntercom({ checkOnly: true });
	}
	// Avoid project trust prompts, project-level packages and resource execution from the caller's cwd.
	if (!dryRun) installDir = mkdtempSync(path.join(tmpdir(), "pi-harness-install-"));
	for (const target of candidates) {
		console.log(`> pi install ${target}`);
		if (!dryRun) {
			try {
				execFileSync("pi", ["install", target], { cwd: installDir, stdio: ["ignore", "inherit", "inherit"] });
			} catch (error) {
				throw new Error(`Fallo al instalar ${target}: ${error.message}`);
			}
		}
	}
	if (setup) {
		configurePi({ dryRun });
		configureIntercom({ dryRun });
	}
	console.log(dryRun ? "Vista previa completa; no se instaló ni escribió nada." : "Instalacion completa.");
} catch (error) {
	console.error(error.message);
	process.exitCode = 1;
} finally {
	if (installDir) rmSync(installDir, { recursive: true, force: true });
}
