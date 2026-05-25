import { padToWidth, truncateToWidth, visibleWidth } from "./minimal-title.ts";

export type SkillStatus = "loading" | "loaded" | "error";
export type ChipStyleKind = "skillLoaded" | "skillLoading" | "skillError" | "skillBorder" | "skillGap";

export function renderSkillChip(
	name: string,
	status: SkillStatus,
	style: (kind: ChipStyleKind, text: string) => string,
): string {
	const suffix = status === "loading" ? "…" : status === "error" ? "!" : "";
	const label = `${name}${suffix}`;
	const labelKind = status === "loading" ? "skillLoading" : status === "error" ? "skillError" : "skillLoaded";
	return `${style("skillBorder", "▏")}${style(labelKind, label)}${style("skillBorder", "▕")}`;
}

export function renderSkillChipRows(
	skills: Map<string, SkillStatus>,
	width: number,
	style: (kind: ChipStyleKind, text: string) => string,
): string[] {
	if (width <= 0 || skills.size === 0) return [];
	const gap = style("skillGap", " ");
	const rows: string[] = [];
	let current = "";

	for (const [name, status] of skills.entries()) {
		const chip = renderSkillChip(name, status, style);
		const candidate = current ? `${current}${gap}${chip}` : chip;
		if (!current || visibleWidth(candidate) <= width) {
			current = candidate;
			continue;
		}
		rows.push(padToWidth(current, width));
		current = visibleWidth(chip) > width ? truncateToWidth(chip, width) : chip;
	}

	if (current) rows.push(padToWidth(current, width));
	return rows;
}
