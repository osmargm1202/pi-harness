type FrontmatterValue = string | string[];

type ParsedFrontmatter = {
	frontmatter: Record<string, string>;
	body: string;
};

type CategoryRouterInput = {
	categorySlug: string;
	categoryTitle?: string;
	members: string[];
};

const TOOL_ALIASES = new Map<string, string>([
	["glob", "find"],
]);

const ALLOWED_PI_TOOLS = new Set(["read", "write", "edit", "bash", "grep", "find", "ls"]);
const DEFAULT_AGENT_TOOLS = ["read", "grep", "find"];

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
	const convertedFrontmatter: Record<string, string> = {
		...frontmatter,
	};

	convertedFrontmatter.tools = frontmatter.tools
		? normalizeTools(frontmatter.tools).join(", ")
		: DEFAULT_AGENT_TOOLS.join(", ");

	const rendered = renderFrontmatter(convertedFrontmatter);
	const trimmedBody = body.trim();
	return trimmedBody ? `${rendered}${trimmedBody}\n` : rendered;
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
		`You route requests for the ${title} category.`,
		`Use query_team with team: \"${categorySlug}\" to inspect available members before delegating.`,
		"Use deploy_agent to hand work to the best fit specialist.",
		"Available members:",
		...members.map((member) => `- ${member}`),
	];

	return `${renderFrontmatter({
		name: categorySlug,
		description: `${title} router agent`,
		tools: "read, grep, find, ls, bash, query_team, deploy_agent",
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
	for (const [teamName, members] of newTeams.entries()) {
		merged.set(teamName, [...members]);
	}

	const sections: string[] = [];
	for (const [teamName, members] of merged.entries()) {
		sections.push([`${teamName}:`, ...members.map((member) => `  - ${member}`)].join("\n"));
	}
	return `${sections.join("\n\n")}\n`;
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
