#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.join(ROOT, "..", "package.json");

function isInstallerPackage(name, spec) {
	if (typeof spec !== "string") return false;
	if (!spec.startsWith("github:") && !spec.startsWith("npm:")) return false;

	if (name.startsWith("pi-")) return true;
	if (name.startsWith("@juicesharp/rpiv-")) return true;
	if (name === "gentle-engram") return true;

	return false;
}

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
const forcePostinstall = args.has("--postinstall") && args.has("--force");
const canAutoInstall =
	!isPostinstall ||
	process.env.npm_config_global === "true" ||
	forcePostinstall;

const candidates = Object.entries({
	...(pkg.dependencies || {}),
	...(pkg.devDependencies || {}),
})
	.filter(([name, spec]) => isInstallerPackage(name, spec))
	.map(([, spec]) =>
		spec.startsWith("github:")
			? `git:${spec.slice("github:".length)}`
			: `npm:${spec.slice("npm:".length)}`,
	)
	.sort();

if (candidates.length === 0) {
	console.error(
		"No se detectaron paquetes instalables desde este package.json.",
	);
	process.exit(1);
}

if (isPostinstall && !canAutoInstall) {
	console.log(
		"Postinstall sin instalación global; usa npm run install:orgm-pi o ejecuta manualmente.",
	);
	process.exit(0);
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
