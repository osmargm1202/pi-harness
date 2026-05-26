import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, isAbsolute, normalize, relative, resolve, sep } from "node:path";

export interface ProjectTreeConfig {
	home?: string;
	maxDepth?: number;
}

const DEFAULT_MAX_DEPTH = 3;
const PROJECT_ROOT_DIRS = new Set(["Code", "Projects", "Developer", "Workspace", "work", "src", "repos"]);
const SYSTEM_ROOTS = new Set(["/", "/root", "/usr", "/etc", "/var", "/run", "/proc", "/sys", "/dev", "/tmp"]);
const IGNORED_DIRS = new Set([".git", ".venv", "node_modules", ".pi-cache", "dist", "build", "coverage"]);
const IGNORED_FILES = new Set([
	".env",
	".DS_Store",
	"bun.lock",
	"bun.lockb",
	"package-lock.json",
	"pnpm-lock.yaml",
	"yarn.lock",
	"npm-shrinkwrap.json",
	"Cargo.lock",
	"Pipfile.lock",
	"poetry.lock",
]);

function normalizedAbsolute(path: string): string {
	return normalize(resolve(path));
}

function isWithin(parent: string, child: string): boolean {
	const rel = relative(parent, child);
	return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function isSystemRoot(path: string): boolean {
	return SYSTEM_ROOTS.has(path);
}

function pathPartsBelowHome(path: string, home: string): string[] {
	const rel = relative(home, path);
	return rel.split(sep).filter(Boolean);
}

export function isSafeProjectRoot(root: string, home = homedir()): boolean {
	const normalizedRoot = normalizedAbsolute(root);
	const normalizedHome = normalizedAbsolute(home);
	if (isSystemRoot(normalizedRoot)) return false;
	if (normalizedRoot === normalizedHome) return false;
	if (!isWithin(normalizedHome, normalizedRoot)) return false;

	const parts = pathPartsBelowHome(normalizedRoot, normalizedHome);
	return parts.length >= 2 && PROJECT_ROOT_DIRS.has(parts[0]);
}

export function resolveTreeRoot(root: string, home = homedir()): string | null {
	const normalizedRoot = normalizedAbsolute(root);
	return isSafeProjectRoot(normalizedRoot, home) ? normalizedRoot : null;
}

function shouldHideFile(name: string): boolean {
	return IGNORED_FILES.has(name) || name.endsWith(".lock") || name.endsWith("-lock.yaml");
}

function safeMaxDepth(value: number | undefined): number {
	return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : DEFAULT_MAX_DEPTH;
}

function renderEntry(name: string, depth: number): string {
	return `${"  ".repeat(depth)}- ${name}`;
}

function walkDirectory(root: string, depth: number, maxDepth: number, lines: string[]): void {
	if (depth >= maxDepth) return;
	const entries = readdirSync(root, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() || entry.isFile())
		.filter((entry) => entry.isDirectory() || !shouldHideFile(entry.name))
		.sort((a, b) => {
			if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
			return a.name.localeCompare(b.name);
		});

	for (const entry of entries) {
		if (entry.isDirectory()) {
			lines.push(renderEntry(`${entry.name}/`, depth + 1));
			if (!IGNORED_DIRS.has(entry.name)) {
				walkDirectory(resolve(root, entry.name), depth + 1, maxDepth, lines);
			}
			continue;
		}
		lines.push(renderEntry(entry.name, depth + 1));
	}
}

export function buildProjectTreeText(root: string, config: ProjectTreeConfig = {}): string {
	const resolvedRoot = resolveTreeRoot(root, config.home);
	if (!resolvedRoot || !existsSync(resolvedRoot) || !statSync(resolvedRoot).isDirectory()) return "";

	const lines = [renderEntry(`${basename(resolvedRoot)}/`, 0)];
	walkDirectory(resolvedRoot, 0, safeMaxDepth(config.maxDepth), lines);
	return lines.join("\n");
}
