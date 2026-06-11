import { basename } from "node:path";

const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;

export type StarshipStyleKind =
	| "cwd"
	| "git"
	| "gitStatus"
	| "runtimePrefix"
	| "runtime"
	| "status"
	| "context"
	| "tokens"
	| "cost"
	| "separator";

export type StarshipGitStatus = {
	branch?: string;
	dirty: boolean;
	ahead: number;
	behind: number;
	conflicted: number;
	untracked: number;
	stashed: boolean;
	modified: number;
	staged: number;
	renamed: number;
	deleted: number;
	typechanged: number;
};

export type StarshipRuntime = {
	name: string;
	symbol: string;
	version?: string;
};

export type BuildStarshipLineInput = {
	cwd: string;
	git?: StarshipGitStatus;
	runtime?: StarshipRuntime;
	extensionStatuses?: ReadonlyMap<string, string>;
	contextLabel: string;
	tokenLabel: string;
	costLabel: string;
	width: number;
	style: (kind: StarshipStyleKind, text: string) => string;
};

export function visibleWidth(text: string): number {
	return Array.from(text.replace(ANSI_PATTERN, "")).length;
}

export function truncateToWidth(text: string, width: number): string {
	if (width <= 0) return "";
	if (visibleWidth(text) <= width) return text;
	const plain = Array.from(text.replace(ANSI_PATTERN, ""));
	if (width === 1) return "…";
	return `${plain.slice(0, width - 1).join("")}…`;
}

export function emptyGitStatus(): StarshipGitStatus {
	return {
		branch: undefined,
		dirty: false,
		ahead: 0,
		behind: 0,
		conflicted: 0,
		untracked: 0,
		stashed: false,
		modified: 0,
		staged: 0,
		renamed: 0,
		deleted: 0,
		typechanged: 0,
	};
}

export function parseGitStatusPorcelain(stdoutText: string, hasStash: boolean): StarshipGitStatus {
	const status = emptyGitStatus();
	status.stashed = hasStash;
	for (const line of stdoutText.split("\n")) {
		if (!line) continue;
		if (line.startsWith("# branch.head ")) {
			const branch = line.slice("# branch.head ".length).trim();
			status.branch = branch && branch !== "(detached)" ? branch : undefined;
			continue;
		}
		if (line.startsWith("# branch.ab ")) {
			const match = line.match(/\+(\d+)\s+-(\d+)/);
			if (match) {
				status.ahead = Number(match[1] ?? 0);
				status.behind = Number(match[2] ?? 0);
			}
			continue;
		}
		if (line.startsWith("? ")) {
			status.dirty = true;
			status.untracked += 1;
			continue;
		}
		if (line.startsWith("u ")) {
			status.dirty = true;
			status.conflicted += 1;
			continue;
		}
		if (!line.startsWith("1 ") && !line.startsWith("2 ")) continue;
		status.dirty = true;
		const xy = line.slice(2, 4);
		const x = xy[0] ?? " ";
		const y = xy[1] ?? " ";
		if (x === "R") status.renamed += 1;
		else if (x === "D") status.deleted += 1;
		else if (x === "T") status.typechanged += 1;
		else if (x === "M") status.modified += 1;
		else if (x !== "." && x !== " ") status.staged += 1;
		if (y === "M") status.modified += 1;
		else if (y === "D") status.deleted += 1;
		else if (y === "T") status.typechanged += 1;
	}
	return status;
}

export function formatGitStatusIndicators(status: StarshipGitStatus): string {
	const parts: string[] = [];
	if (status.modified > 0 || status.typechanged > 0) parts.push("!");
	if (status.untracked > 0) parts.push("?");
	if (status.staged > 0) parts.push("+");
	if (status.deleted > 0) parts.push("✘");
	if (status.renamed > 0) parts.push("»");
	if (status.conflicted > 0) parts.push("=");
	if (status.stashed) parts.push("$");
	if (status.ahead > 0 && status.behind > 0) parts.push("⇕");
	else if (status.ahead > 0) parts.push("↑");
	else if (status.behind > 0) parts.push("↓");
	return parts.length > 0 ? `[${parts.join("")}]` : "";
}

export function detectRuntimeFromEntries(entries: string[], env: { nodeVersion?: string } = {}): StarshipRuntime | undefined {
	if (entries.includes("package.json") || entries.includes(".node-version") || entries.includes(".nvmrc")) {
		return { name: "node", symbol: "", version: env.nodeVersion ?? process.version };
	}
	if (entries.includes("bun.lock") || entries.includes("bun.lockb")) return { name: "bun", symbol: "" };
	if (entries.includes("go.mod")) return { name: "go", symbol: "" };
	if (entries.includes("Cargo.toml")) return { name: "rust", symbol: "" };
	if (entries.includes("pyproject.toml") || entries.includes("requirements.txt")) return { name: "python", symbol: "" };
	return undefined;
}

function formatCwd(cwd: string): string {
	const normalized = cwd.replace(/[\\/]+$/, "");
	return `󰝰 ${basename(normalized) || normalized || "."}`;
}

function visibleJoin(parts: string[], separator: string): string {
	return parts.filter(Boolean).join(separator);
}

export function buildStarshipLine(input: BuildStarshipLineInput): string {
	if (input.width <= 0) return "";
	const separator = input.style("separator", " · ");
	const leftParts: string[] = [input.style("cwd", formatCwd(input.cwd))];
	if (input.git?.branch) {
		const indicators = formatGitStatusIndicators(input.git);
		leftParts.push(input.style("git", `on  ${input.git.branch}`) + (indicators ? ` ${input.style("gitStatus", indicators)}` : ""));
	}
	if (input.runtime) {
		const label = input.runtime.version ? `${input.runtime.symbol} ${input.runtime.version}` : input.runtime.symbol;
		leftParts.push(`${input.style("runtimePrefix", "via")} ${input.style("runtime", label)}`);
	}
	const statuses = [...(input.extensionStatuses ?? new Map()).entries()]
		.filter(([key, value]) => key !== "orgm-limit" && key !== "orgm-minimal" && Boolean(value))
		.map(([, value]) => input.style("status", value));
	leftParts.push(...statuses);

	const rightParts = [
		input.style("context", input.contextLabel),
		input.style("tokens", input.tokenLabel),
		input.style("cost", input.costLabel),
	];
	const left = visibleJoin(leftParts, separator);
	const right = visibleJoin(rightParts, separator);
	const gap = input.width - visibleWidth(left) - visibleWidth(right);
	if (gap >= 2) return `${left}${" ".repeat(gap)}${right}`;
	return truncateToWidth(visibleJoin([...leftParts, ...rightParts], separator), input.width);
}
