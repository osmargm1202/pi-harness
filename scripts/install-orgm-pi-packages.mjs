#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.join(ROOT, "..", "package.json");

// Stack to install: soporte mixto github:* y npm:*
const PACKAGES = [
	"github:osmargm1202/pi-banner",
	"github:osmargm1202/pi-caveman",
	"github:osmargm1202/pi-clear",
	"github:osmargm1202/pi-footer",
	"github:osmargm1202/pi-init",
	"github:osmargm1202/pi-limit",
	"github:osmargm1202/pi-notify",
	"github:osmargm1202/pi-rename",
	"github:osmargm1202/pi-themes",
	"github:osmargm1202/pi-title",
	"npm:@juicesharp/rpiv-ask-user-question",
	"npm:@juicesharp/rpiv-todo",
	"npm:gentle-engram",
	"npm:pi-intercom",
	"npm:pi-lens",
	"npm:pi-mcp-adapter",
	"npm:pi-subagents-j0k3r",
	"npm:pi-web-access",
];

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
const isPostinstall = args.has("--postinstall");
const forcePostinstall = isPostinstall && args.has("--force");
const canAutoInstall =
	!isPostinstall ||
	process.env.npm_config_global === "true" ||
	forcePostinstall;

const candidates = [...new Set(PACKAGES)]
	.filter((target) => target.startsWith("github:") || target.startsWith("npm:"))
	.map((target) =>
		target.startsWith("github:")
			? `git:${target.slice("github:".length)}`
			: `npm:${target.slice("npm:".length)}`,
	)
	.sort();

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
for (const target of candidates) {
	const command = `pi install ${target}`;
	console.log(`> ${command}`);

	if (dryRun) {
		continue;
	}

	try {
		execSync(command, { stdio: "inherit" });
	} catch (error) {
		const ref = String(error?.message || error);
		console.error(`Fallo al instalar ${target}: ${ref}`);
		process.exit(1);
	}
}

console.log("Instalacion completa.");
