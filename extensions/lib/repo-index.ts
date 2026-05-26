import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { basename, extname, join, relative, sep } from "node:path";

export interface RepoIndexOptions {
	rootDir?: string;
	cacheDir?: string;
	maxFileBytes?: number;
	now?: Date;
}

export interface RepoIndex {
	version: 1;
	generatedAt: string;
	project: {
		name: string;
		root: string;
		packageManager?: string;
		languages: string[];
	};
	git: {
		branch?: string;
		commit?: string;
		dirty?: boolean;
	};
	ignore: {
		dirs: string[];
		files: string[];
	};
	stats: {
		files: number;
		skippedLargeFiles: number;
	};
	files: Record<string, RepoIndexFile>;
}

export interface RepoIndexFile {
	generated: {
		kind: string;
		language?: string;
		lines: number;
		bytes: number;
		hash: string;
		exports: string[];
		imports: string[];
		updatedAt: string;
	};
	persistent: {
		summary: string;
		notes: string[];
		relatedFiles: string[];
		ownerHints: string[];
	};
}

const DEFAULT_CACHE_DIR = ".pi-cache";
const DEFAULT_MAX_FILE_BYTES = 250_000;

export const DEFAULT_IGNORED_DIRS = [
	".git",
	".pi",
	".agents",
	".pi-cache",
	"node_modules",
	".next",
	"dist",
	"build",
	"coverage",
	".cache",
	".pytest_cache",
	"__pycache__",
	".venv",
	"venv",
	"target",
	"vendor",
];

export const DEFAULT_IGNORED_FILES = [
	".DS_Store",
	"bun.lockb",
	"bun.lock",
	"package-lock.json",
	"pnpm-lock.yaml",
	"yarn.lock",
];

const BINARY_EXTENSIONS = new Set([
	".png",
	".jpg",
	".jpeg",
	".gif",
	".webp",
	".ico",
	".pdf",
	".zip",
	".gz",
	".tar",
	".tgz",
	".wasm",
	".pyc",
	".sqlite",
	".db",
]);

const LANGUAGE_BY_EXT: Record<string, string> = {
	".ts": "typescript",
	".tsx": "typescriptreact",
	".js": "javascript",
	".jsx": "javascriptreact",
	".json": "json",
	".md": "markdown",
	".mdx": "mdx",
	".py": "python",
	".rs": "rust",
	".go": "go",
	".sh": "shell",
	".css": "css",
	".html": "html",
	".yaml": "yaml",
	".yml": "yaml",
};

function toPosix(path: string): string {
	return path.split(sep).join("/");
}

function stableUnique(values: string[]): string[] {
	return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function sha256(content: string): string {
	return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function readJson(path: string): unknown | undefined {
	try {
		return JSON.parse(readFileSync(path, "utf8"));
	} catch {
		return undefined;
	}
}

export function loadRepoIndex(path: string): RepoIndex | undefined {
	const parsed = readJson(path);
	if (!parsed || typeof parsed !== "object") return undefined;
	return parsed as RepoIndex;
}

function detectPackageManager(rootDir: string): string | undefined {
	if (existsSync(join(rootDir, "pnpm-lock.yaml"))) return "pnpm";
	if (existsSync(join(rootDir, "bun.lockb")) || existsSync(join(rootDir, "bun.lock"))) return "bun";
	if (existsSync(join(rootDir, "yarn.lock"))) return "yarn";
	if (existsSync(join(rootDir, "package-lock.json"))) return "npm";
	return undefined;
}

function detectProjectName(rootDir: string): string {
	const pkg = readJson(join(rootDir, "package.json"));
	if (pkg && typeof pkg === "object" && "name" in pkg && typeof pkg.name === "string") return pkg.name;
	return basename(rootDir);
}

function getGitInfo(rootDir: string): RepoIndex["git"] {
	try {
		const execOptions = { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] } as const;
		const branch = execFileSync("git", ["-C", rootDir, "branch", "--show-current"], execOptions).trim() || undefined;
		const commit = execFileSync("git", ["-C", rootDir, "rev-parse", "--short", "HEAD"], execOptions).trim() || undefined;
		const status = execFileSync("git", ["-C", rootDir, "status", "--short"], execOptions).trim();
		return { branch, commit, dirty: status.length > 0 };
	} catch {
		return {};
	}
}

function shouldIgnoreDir(name: string): boolean {
	return DEFAULT_IGNORED_DIRS.includes(name);
}

function shouldIgnoreFile(name: string): boolean {
	if (DEFAULT_IGNORED_FILES.includes(name)) return true;
	if (name.endsWith(".log")) return true;
	return BINARY_EXTENSIONS.has(extname(name).toLowerCase());
}

function collectFiles(rootDir: string): string[] {
	const files: string[] = [];
	const visit = (dir: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (entry.isDirectory()) {
				if (!shouldIgnoreDir(entry.name)) visit(join(dir, entry.name));
				continue;
			}
			if (!entry.isFile() || shouldIgnoreFile(entry.name)) continue;
			files.push(toPosix(relative(rootDir, join(dir, entry.name))));
		}
	};
	visit(rootDir);
	return files.sort((a, b) => a.localeCompare(b));
}

function detectKind(path: string): string {
	const name = basename(path);
	if (name === "package.json" || name.endsWith("config.json")) return "manifest";
	if (path.includes("/test") || name.includes(".test.") || name.includes(".spec.")) return "test";
	if ([".md", ".mdx"].includes(extname(path).toLowerCase())) return "docs";
	if ([".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go"].includes(extname(path).toLowerCase())) return "source";
	return "asset";
}

function detectLanguage(path: string): string | undefined {
	return LANGUAGE_BY_EXT[extname(path).toLowerCase()];
}

function extractExports(content: string, language?: string): string[] {
	if (!language?.includes("typescript") && !language?.includes("javascript")) return [];
	const names: string[] = [];
	for (const match of content.matchAll(/export\s+(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g)) {
		if (match[1]) names.push(match[1]);
	}
	for (const match of content.matchAll(/export\s*\{([^}]+)\}/g)) {
		const parts = (match[1] ?? "").split(",").map((part) => part.trim().split(/\s+as\s+/i).pop()?.trim()).filter(Boolean) as string[];
		names.push(...parts);
	}
	const defaultMatches = content.match(/export\s+default\s+/g) ?? [];
	if (defaultMatches.length > 0) names.push("default");
	return stableUnique(names);
}

function extractImports(content: string, language?: string): string[] {
	if (!language?.includes("typescript") && !language?.includes("javascript")) return [];
	const imports: string[] = [];
	for (const match of content.matchAll(/import(?:\s+type)?(?:[^"']*from\s*)?["']([^"']+)["']/g)) {
		if (match[1]) imports.push(match[1]);
	}
	for (const match of content.matchAll(/require\(["']([^"']+)["']\)/g)) {
		if (match[1]) imports.push(match[1]);
	}
	return stableUnique(imports);
}

function defaultPersistent(previous?: RepoIndexFile): RepoIndexFile["persistent"] {
	return {
		summary: previous?.persistent?.summary ?? "",
		notes: Array.isArray(previous?.persistent?.notes) ? previous.persistent.notes : [],
		relatedFiles: Array.isArray(previous?.persistent?.relatedFiles) ? previous.persistent.relatedFiles : [],
		ownerHints: Array.isArray(previous?.persistent?.ownerHints) ? previous.persistent.ownerHints : [],
	};
}

function createFileEntry(rootDir: string, path: string, nowIso: string, previous?: RepoIndexFile): RepoIndexFile | undefined {
	const absolute = join(rootDir, path);
	const stat = statSync(absolute);
	const content = readFileSync(absolute, "utf8");
	const language = detectLanguage(path);
	return {
		generated: {
			kind: detectKind(path),
			language,
			lines: content.length === 0 ? 0 : content.split("\n").length - (content.endsWith("\n") ? 1 : 0),
			bytes: stat.size,
			hash: sha256(content),
			exports: extractExports(content, language),
			imports: extractImports(content, language),
			updatedAt: nowIso,
		},
		persistent: defaultPersistent(previous),
	};
}

export function generateRepoContext(index: RepoIndex): string {
	const languages = index.project.languages.length ? index.project.languages.join(", ") : "unknown";
	const lines = [
		"# Repo Context",
		"",
		`- Project: ${index.project.name}`,
		`- Root: ${index.project.root}`,
		`- Generated: ${index.generatedAt}`,
		`- Git: ${index.git.branch ?? "unknown"}@${index.git.commit ?? "unknown"}${index.git.dirty ? " dirty" : ""}`,
		`- Files indexed: ${index.stats.files}`,
		`- Languages: ${languages}`,
		"",
		"## Files",
	];

	for (const [path, file] of Object.entries(index.files).sort(([a], [b]) => a.localeCompare(b))) {
		const generated = file.generated;
		const parts = [generated.kind, generated.language, `${generated.lines} lines`].filter(Boolean).join(" · ");
		lines.push(`- ${path} (${parts})`);
		if (generated.exports.length) lines.push(`  - exports: ${generated.exports.join(", ")}`);
		if (file.persistent.summary) lines.push(`  - summary: ${file.persistent.summary}`);
		if (file.persistent.notes.length) lines.push(`  - notes: ${file.persistent.notes.join("; ")}`);
		if (file.persistent.relatedFiles.length) lines.push(`  - related: ${file.persistent.relatedFiles.join(", ")}`);
	}

	return `${lines.join("\n")}\n`;
}

export function generateRepoIndex(options: RepoIndexOptions = {}): RepoIndex {
	const rootDir = options.rootDir ?? process.cwd();
	const cacheDir = options.cacheDir ?? join(rootDir, DEFAULT_CACHE_DIR);
	const indexPath = join(cacheDir, "repo-index.json");
	const contextPath = join(cacheDir, "repo-context.md");
	const nowIso = (options.now ?? new Date()).toISOString();
	const previous = loadRepoIndex(indexPath);
	const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
	let skippedLargeFiles = 0;
	const files: RepoIndex["files"] = {};
	const languages = new Set<string>();

	for (const path of collectFiles(rootDir)) {
		const stat = statSync(join(rootDir, path));
		if (stat.size > maxFileBytes) {
			skippedLargeFiles += 1;
			continue;
		}
		const entry = createFileEntry(rootDir, path, nowIso, previous?.files?.[path]);
		if (!entry) continue;
		files[path] = entry;
		if (entry.generated.language) languages.add(entry.generated.language);
	}

	const index: RepoIndex = {
		version: 1,
		generatedAt: nowIso,
		project: {
			name: detectProjectName(rootDir),
			root: rootDir,
			packageManager: detectPackageManager(rootDir),
			languages: [...languages].sort((a, b) => a.localeCompare(b)),
		},
		git: getGitInfo(rootDir),
		ignore: {
			dirs: DEFAULT_IGNORED_DIRS,
			files: DEFAULT_IGNORED_FILES,
		},
		stats: {
			files: Object.keys(files).length,
			skippedLargeFiles,
		},
		files,
	};

	mkdirSync(cacheDir, { recursive: true });
	writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
	writeFileSync(contextPath, generateRepoContext(index), "utf8");
	return index;
}
