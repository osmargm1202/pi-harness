import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

function readPkg() {
	try {
		const raw = readFileSync("package.json", "utf8");
		return JSON.parse(raw);
	} catch (error) {
		assert.fail(`No se pudo leer package.json: ${String(error)}`);
	}
}

test("pi-harness no expone manifiesto pi", () => {
	const pkg = readPkg();
	assert.ok(!pkg.pi, "No debe existir el campo pi en package.json");
});

test("scripts de instalacion existen", () => {
	const pkg = readPkg();
	assert.equal(typeof pkg.scripts?.postinstall, "string");
	assert.equal(typeof pkg.scripts?.["install:orgm-pi"], "string");
	assert.ok(pkg.bin && pkg.bin["pi-harness"]);
	assert.ok(pkg.bin && pkg.bin["pi-harness-install"]);
	assert.ok(Array.isArray(pkg.files) && pkg.files.includes("scripts/*.mjs"));
});

test("script incluye catálogo interno de paquetes", () => {
	const result = spawnSync(
		"node",
		["scripts/install-orgm-pi-packages.mjs", "--dry-run"],
		{
			encoding: "utf8",
		},
	);

	assert.equal(result.status, 0, result.stderr || "script fallo");
	const out = `${result.stdout ?? ""}${result.stderr ?? ""}`;
	assert.match(out, /pi install git:github\.com\/osmargm1202\/pi-banner/);
	assert.match(out, /pi install npm:pi-lens/);
	assert.match(out, /pi install npm:pi-web-access/);
	assert.match(out, /pi install npm:@juicesharp\/rpiv-ask-user-question/);
	assert.match(out, /pi install npm:@hypabolic\/pi-hypa/);
	assert.match(out, /pi install npm:gentle-engram/);
});
