import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

type FrontmatterValue = string | string[];

export type ParsedFrontmatter = {
	frontmatter: Record<string, string>;
	body: string;
};

export type GitHubContentEntry = {
	type: "file" | "dir";
	name: string;
	path: string;
	download_url: string | null;
	url: string;
};

export type VoltAgentManifest = {
	sourceRepo: string;
	sourceRef: string;
	generatedAt: string;
	categories: Array<{
		category: string;
		count: number;
		agents: string[];
	}>;
};

type CategoryRouterInput = {
	categorySlug: string;
	categoryTitle?: string;
	members: string[];
};

type ImportedAgent = {
	fileName: string;
	agentName: string;
	content: string;
};

type ImportedCategory = {
	categorySlug: string;
	categoryTitle: string;
	agents: ImportedAgent[];
};

const TOOL_ALIASES = new Map<string, string>([
	["glob", "find"],
]);

const ENGRAM_TOOLS = [
	"engram_mem_context",
	"engram_mem_search",
	"engram_mem_get_observation",
	"engram_mem_save",
	"engram_mem_save_prompt",
	"engram_mem_session_start",
	"engram_mem_session_end",
	"engram_mem_session_summary",
	"engram_mem_suggest_topic_key",
	"engram_mem_update",
	"engram_mem_capture_passive",
] as const;

const ALLOWED_PI_TOOLS = new Set([
	"read",
	"write",
	"edit",
	"bash",
	"grep",
	"find",
	"ls",
	...ENGRAM_TOOLS,
]);
const DEFAULT_AGENT_TOOLS = ["read", "grep", "find", ...ENGRAM_TOOLS];
const SOURCE_REPO = "VoltAgent/awesome-claude-code-subagents";
const SOURCE_REF = "main";
const CATEGORY_ROOT = "categories";
const CATEGORY_DIR_PATTERN = /^\d{2}-[a-z0-9-]+$/;
const GITHUB_API_HEADERS = {
	accept: "application/vnd.github+json",
	"user-agent": "pi-harness-voltagent-import",
	"x-github-api-version": "2022-11-28",
};

export function parseFrontmatter(markdown: string, filename = "agent.md"): ParsedFrontmatter {
	const normalized = markdown.replace(/\r\n/g, "\n");
	const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	if (!match) {
		throw new Error(`Missing frontmatter in ${filename}`);
	}

	const [, rawFrontmatter, body = ""] = match;
	const frontmatter: Record<string, string> = {};
	for (const line of rawFrontmatter.split("\n")) {
		if (!line.trim()) continue;
		const separatorIndex = line.indexOf(":");
		if (separatorIndex === -1) {
			throw new Error(`Invalid frontmatter line in ${filename}: ${line}`);
		}
		const key = line.slice(0, separatorIndex).trim();
		const rawValue = line.slice(separatorIndex + 1).trim();
		frontmatter[key] = unquote(rawValue);
	}

	return { frontmatter, body };
}

export function normalizeTools(tools: string | string[]): string[] {
	const values = Array.isArray(tools) ? tools : tools.split(",");
	const normalized: string[] = [];
	for (const value of values) {
		const trimmed = value.trim();
		if (!trimmed) continue;
		const canonical = TOOL_ALIASES.get(trimmed.toLowerCase()) ?? trimmed.toLowerCase();
		if (!ALLOWED_PI_TOOLS.has(canonical) || normalized.includes(canonical)) {
			continue;
		}
		normalized.push(canonical);
	}
	for (const tool of ENGRAM_TOOLS) {
		if (!normalized.includes(tool)) {
			normalized.push(tool);
		}
	}
	return normalized;
}

export function renderFrontmatter(frontmatter: Record<string, FrontmatterValue>): string {
	const lines = ["---"];
	for (const [key, value] of Object.entries(frontmatter)) {
		if (value == null) continue;
		const renderedValue = Array.isArray(value) ? value.join(", ") : value;
		lines.push(`${key}: ${formatYamlScalar(key, renderedValue)}`);
	}
	lines.push("---");
	return `${lines.join("\n")}\n`;
}

export function convertAgentMarkdown(markdown: string, filename = "agent.md"): string {
	const { frontmatter, body } = parseFrontmatter(markdown, filename);
	const { model: _ignoredModel, ...restFrontmatter } = frontmatter;
	const convertedFrontmatter: Record<string, string> = {
		...restFrontmatter,
	};

	convertedFrontmatter.tools = frontmatter.tools
		? normalizeTools(frontmatter.tools).join(", ")
		: DEFAULT_AGENT_TOOLS.join(", ");

	const rendered = renderFrontmatter(convertedFrontmatter);
	const trimmedBody = body.trim();
	return trimmedBody ? `${rendered}${trimmedBody}\n` : rendered;
}

export function buildImportedAgent(markdown: string, fileName: string): ImportedAgent {
	const content = convertAgentMarkdown(markdown, fileName);
	const { frontmatter } = parseFrontmatter(content, fileName);
	const agentName = frontmatter.name?.trim();
	if (!agentName) {
		throw new Error(`Imported agent missing name frontmatter in ${fileName}`);
	}

	return {
		// Keep upstream filename stable on disk. Team membership and collision checks use `name`.
		fileName,
		agentName,
		content,
	};
}

export function titleFromCategorySlug(categorySlug: string): string {
	return categorySlug
		.replace(/^\d+-/, "")
		.split("-")
		.filter(Boolean)
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(" ");
}

export function generateCategoryRouter({
	categorySlug,
	categoryTitle,
	members,
}: CategoryRouterInput): string {
	const title = categoryTitle?.trim() || titleFromCategorySlug(categorySlug);
	const promptLines = [
		`You are selective router for ${title} category.`,
		"You may handle work inline when the task does not warrant deploying agents or passing context beyond the current session.",
		`Use query_team with team: \"${categorySlug}\" when specialist guidance is warranted, independent questions can run in parallel, or team coordination is useful.`,
		"Use deploy_agent when concrete specialist execution, review, or verification warrants a dedicated agent.",
		"Choose the smallest safe workflow; do not fan out or deploy by default.",
		"Available members:",
		...members.map((member) => `- ${member}`),
	];

	return `${renderFrontmatter({
		name: categorySlug,
		description: `${title} router agent`,
		tools: ["read", "grep", "find", "ls", "bash", "query_team", "deploy_agent", ...ENGRAM_TOOLS].join(", "),
		team: categorySlug,
	})}${promptLines.join("\n")}\n`;
}

export function parseTeams(teamsYaml: string): Map<string, string[]> {
	const teams = new Map<string, string[]>();
	let currentTeam: string | null = null;

	for (const rawLine of teamsYaml.replace(/\r\n/g, "\n").split("\n")) {
		const line = rawLine.replace(/\s+$/g, "");
		if (!line.trim()) continue;
		if (!line.startsWith(" ")) {
			if (!line.endsWith(":")) {
				throw new Error(`Invalid teams entry: ${line}`);
			}
			currentTeam = line.slice(0, -1).trim();
			teams.set(currentTeam, []);
			continue;
		}

		if (!currentTeam) {
			throw new Error(`Team member declared before team name: ${line}`);
		}
		const memberMatch = line.match(/^\s*-\s+(.+)$/);
		if (!memberMatch) {
			throw new Error(`Invalid team member entry: ${line}`);
		}
		teams.get(currentTeam)?.push(memberMatch[1].trim());
	}

	return teams;
}

export function mergeTeamsYaml(existingYaml: string, newTeams: Map<string, string[]>): string {
	const merged = parseTeams(existingYaml);
	for (const teamName of merged.keys()) {
		if (CATEGORY_DIR_PATTERN.test(teamName)) {
			merged.delete(teamName);
		}
	}
	for (const [teamName, members] of newTeams.entries()) {
		merged.set(teamName, [...members]);
	}

	const sections: string[] = [];
	for (const [teamName, members] of merged.entries()) {
		sections.push([`${teamName}:`, ...members.map((member) => `  - ${member}`)].join("\n"));
	}
	return `${sections.join("\n\n")}\n`;
}

export function filterAgentEntries(entries: GitHubContentEntry[]): GitHubContentEntry[] {
	return entries.filter((entry) => {
		if (entry.type !== "file") return false;
		if (!entry.name.endsWith(".md")) return false;
		if (entry.name.toLowerCase() === "readme.md") return false;
		if (!entry.download_url) return false;
		const pathParts = entry.path.split("/");
		return !pathParts.includes(".claude-plugin");
	});
}

export function buildManifest(
	teams: Map<string, string[]>,
	existingManifest?: VoltAgentManifest | null,
): VoltAgentManifest {
	const categories = Array.from(teams.entries()).map(([category, agents]) => ({
		category,
		count: agents.length,
		agents: [...agents],
	}));
	const generatedAt = shouldPreserveGeneratedAt(existingManifest, categories)
		? existingManifest.generatedAt
		: new Date().toISOString();

	return {
		sourceRepo: SOURCE_REPO,
		sourceRef: SOURCE_REF,
		generatedAt,
		categories,
	};
}

export async function fetchJson<T>(url: string): Promise<T> {
	const response = await fetch(url, { headers: GITHUB_API_HEADERS });
	if (!response.ok) {
		throw new Error(`Failed to fetch JSON from ${url}: ${response.status} ${response.statusText}`);
	}
	return await response.json() as T;
}

export async function fetchText(url: string): Promise<string> {
	const response = await fetch(url, { headers: GITHUB_API_HEADERS });
	if (!response.ok) {
		throw new Error(`Failed to fetch text from ${url}: ${response.status} ${response.statusText}`);
	}
	return await response.text();
}

export function assertNoAgentNameCollisions(categories: ImportedCategory[]): void {
	const seen = new Map<string, string>();
	for (const category of categories) {
		for (const agent of category.agents) {
			const previousCategory = seen.get(agent.agentName);
			if (previousCategory) {
				throw new Error(
					`Agent name collision for ${agent.agentName}: ${previousCategory} and ${category.categorySlug}`,
				);
			}
			seen.set(agent.agentName, category.categorySlug);
		}
	}
}

export function assertNoExistingAgentNameCollisions(
	rootDir: string,
	categories: ImportedCategory[],
): void {
	const agentsDir = join(rootDir, "agents");
	if (!existsSync(agentsDir)) return;

	const importedAgentOrigins = new Map<string, string>();
	for (const category of categories) {
		for (const agent of category.agents) {
			importedAgentOrigins.set(agent.agentName, `${category.categorySlug}/${agent.fileName}`);
		}
	}
	if (importedAgentOrigins.size === 0) return;

	const existingManifest = readVoltAgentManifest(join(agentsDir, "voltagent-manifest.json"));
	const managedCategoryDirs = new Set(
		existingManifest?.sourceRepo === SOURCE_REPO && existingManifest.sourceRef === SOURCE_REF
			? existingManifest.categories.map((category) => category.category)
			: [],
	);

	for (const filePath of listMarkdownFiles(agentsDir)) {
		const relativeFromAgents = relative(agentsDir, filePath);
		const [topLevelDir] = relativeFromAgents.split(sep);
		if (topLevelDir && managedCategoryDirs.has(topLevelDir)) {
			continue;
		}

		const displayPath = toPosixPath(relative(rootDir, filePath));
		const { frontmatter } = parseFrontmatter(readFileSync(filePath, "utf8"), displayPath);
		const existingName = frontmatter.name?.trim();
		if (!existingName) continue;

		const importedOrigin = importedAgentOrigins.get(existingName);
		if (importedOrigin) {
			throw new Error(
				`Existing agent name collision for ${existingName}: imported ${importedOrigin} conflicts with ${displayPath}`,
			);
		}
	}
}

export async function importVoltAgentAgents(rootDir = getRepoRoot()): Promise<VoltAgentManifest> {
	const categoriesUrl = buildContentsApiUrl(CATEGORY_ROOT);
	const categoryEntries = await fetchJson<GitHubContentEntry[]>(categoriesUrl);
	const categoryDirs = categoryEntries
		.filter((entry) => entry.type === "dir" && CATEGORY_DIR_PATTERN.test(entry.name))
		.sort((a, b) => a.name.localeCompare(b.name));

	const importedCategories: ImportedCategory[] = [];
	for (const categoryEntry of categoryDirs) {
		const categoryContents = await fetchJson<GitHubContentEntry[]>(categoryEntry.url || buildContentsApiUrl(categoryEntry.path));
		const agentEntries = filterAgentEntries(categoryContents).sort((a, b) => a.name.localeCompare(b.name));
		const agents: ImportedAgent[] = [];
		for (const agentEntry of agentEntries) {
			const markdown = await fetchText(agentEntry.download_url!);
			agents.push(buildImportedAgent(markdown, agentEntry.name));
		}
		importedCategories.push({
			categorySlug: categoryEntry.name,
			categoryTitle: titleFromCategorySlug(categoryEntry.name),
			agents,
		});
	}

	assertNoAgentNameCollisions(importedCategories);
	assertNoExistingAgentNameCollisions(rootDir, importedCategories);

	const teams = new Map<string, string[]>();
	for (const category of importedCategories) {
		teams.set(category.categorySlug, category.agents.map((agent) => agent.agentName));
	}

	const agentsDir = join(rootDir, "agents");
	const existingManifest = readVoltAgentManifest(join(agentsDir, "voltagent-manifest.json"));

	for (const category of importedCategories) {
		ensureManagedCategoryDir(agentsDir, category.categorySlug);
		const categoryDir = join(agentsDir, category.categorySlug);
		mkdirSync(categoryDir, { recursive: true });
		writeFileSync(
			join(categoryDir, "index.md"),
			generateCategoryRouter({
				categorySlug: category.categorySlug,
				categoryTitle: category.categoryTitle,
				members: category.agents.map((agent) => agent.agentName),
			}),
		);
		for (const agent of category.agents) {
			writeFileSync(join(categoryDir, agent.fileName), agent.content);
		}
	}

	const teamsPath = join(agentsDir, "teams.yaml");
	const existingTeamsYaml = existsSync(teamsPath) ? readFileSync(teamsPath, "utf8") : "";
	writeFileSync(teamsPath, mergeTeamsYaml(existingTeamsYaml, teams));

	const manifest = buildManifest(teams, existingManifest);
	writeFileSync(join(agentsDir, "voltagent-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
	return manifest;
}

export function ensureManagedCategoryDir(agentsDir: string, categorySlug: string): void {
	const categoryDir = join(agentsDir, categorySlug);
	if (!existsSync(categoryDir)) return;

	const manifestPath = join(agentsDir, "voltagent-manifest.json");
	const manifest = readVoltAgentManifest(manifestPath);
	const hasMatchingCategory = manifest?.sourceRepo === SOURCE_REPO
		&& manifest.sourceRef === SOURCE_REF
		&& manifest.categories.some((category) => category.category === categorySlug);

	if (!hasMatchingCategory) {
		throw new Error(
			`Refusing to overwrite existing VoltAgent category directory ${categoryDir} without matching ${manifestPath} entry for ${SOURCE_REPO}@${SOURCE_REF} category ${categorySlug}.`,
		);
	}

	rmSync(categoryDir, { recursive: true, force: true });
}

function readVoltAgentManifest(manifestPath: string): VoltAgentManifest | null {
	if (!existsSync(manifestPath)) return null;
	try {
		const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Partial<VoltAgentManifest>;
		if (!Array.isArray(manifest.categories)) return null;
		return {
			sourceRepo: typeof manifest.sourceRepo === "string" ? manifest.sourceRepo : "",
			sourceRef: typeof manifest.sourceRef === "string" ? manifest.sourceRef : "",
			generatedAt: typeof manifest.generatedAt === "string" ? manifest.generatedAt : "",
			categories: manifest.categories
				.filter((category): category is VoltAgentManifest["categories"][number] => {
					return typeof category === "object"
						&& category != null
						&& typeof category.category === "string"
						&& typeof category.count === "number"
						&& Array.isArray(category.agents);
				})
				.map((category) => ({
					category: category.category,
					count: category.count,
					agents: category.agents.filter((agent): agent is string => typeof agent === "string"),
				})),
		};
	} catch {
		return null;
	}
}

function shouldPreserveGeneratedAt(
	existingManifest: VoltAgentManifest | null | undefined,
	categories: VoltAgentManifest["categories"],
): existingManifest is VoltAgentManifest {
	return existingManifest?.sourceRepo === SOURCE_REPO
		&& existingManifest.sourceRef === SOURCE_REF
		&& JSON.stringify(existingManifest.categories) === JSON.stringify(categories)
		&& typeof existingManifest.generatedAt === "string"
		&& existingManifest.generatedAt.length > 0;
}

function buildContentsApiUrl(path: string): string {
	return `https://api.github.com/repos/${SOURCE_REPO}/contents/${path}?ref=${SOURCE_REF}`;
}

function listMarkdownFiles(dir: string): string[] {
	if (!existsSync(dir)) return [];

	const files: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const entryPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...listMarkdownFiles(entryPath));
			continue;
		}
		if (entry.isFile() && entry.name.endsWith(".md")) {
			files.push(entryPath);
		}
	}
	return files;
}

function toPosixPath(path: string): string {
	return path.split(sep).join("/");
}

function getRepoRoot(): string {
	return dirname(dirname(fileURLToPath(import.meta.url)));
}

export function resolveRootDirArg(argv: string[], cwd: string): string {
	return argv[2] ?? cwd;
}

export function formatCliError(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function unquote(value: string): string {
	if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
		return value.slice(1, -1);
	}
	return value;
}

function formatYamlScalar(key: string, value: string): string {
	if (key === "description" || /[:#]|^\s|\s$/.test(value)) {
		return JSON.stringify(value);
	}
	return value;
}

async function main(): Promise<void> {
	const manifest = await importVoltAgentAgents(resolveRootDirArg(process.argv, process.cwd()));
	console.log(
		`Imported ${manifest.categories.reduce((sum, category) => sum + category.count, 0)} agents across ${manifest.categories.length} categories.`,
	);
}

if (import.meta.main) {
	main().catch((error) => {
		console.error(formatCliError(error));
		process.exitCode = 1;
	});
}
