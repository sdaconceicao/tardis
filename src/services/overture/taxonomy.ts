import { createHash } from "node:crypto";
import {
	categoryPolicy,
	excludedCategoryRoots,
} from "../../../config/overture/category-policy.ts";

export const taxonomySha256 =
	"59eecbf9e24859bcdab459e8efeea673b7fcbab06b45bd1c7067f215b3bc25d4";

export type CategoryGroup = keyof typeof categoryPolicy;
export type CategoryMapping = {
	selected: Map<string, CategoryGroup>;
	excluded: Set<string>;
	allIds: Set<string>;
};

export function resolveCategoryMapping(
	csv: string,
	expectedHash = taxonomySha256,
): CategoryMapping {
	const hash = createHash("sha256").update(csv).digest("hex");
	if (hash !== expectedHash)
		throw new Error("Overture taxonomy checksum mismatch");
	const lines = csv.trimEnd().split(/\r?\n/);
	if (
		lines.shift() !== "taxonomy,primary,displayName,level,isBasic,basicCategory"
	) {
		throw new Error("Unexpected Overture taxonomy header");
	}
	const roots = new Set(Object.values(categoryPolicy).flat());
	const exclusions = new Set<string>(excludedCategoryRoots);
	const selected = new Map<string, CategoryGroup>();
	const excluded = new Set<string>();
	const allIds = new Set<string>();
	for (const line of lines) {
		// The taxonomy path and primary ID are snake-case values without CSV escapes.
		const firstComma = line.indexOf(",");
		const secondComma = line.indexOf(",", firstComma + 1);
		if (firstComma < 0 || secondComma < 0)
			throw new Error("Invalid taxonomy row");
		const path = line.slice(0, firstComma).split(" > ");
		const id = line.slice(firstComma + 1, secondComma);
		if (!id || path.at(-1) !== id || allIds.has(id)) {
			throw new Error(`Invalid or duplicate taxonomy ID: ${id}`);
		}
		allIds.add(id);
		if (path.some((part) => exclusions.has(part))) {
			excluded.add(id);
			continue;
		}
		for (const [group, groupRoots] of Object.entries(categoryPolicy)) {
			if (
				path.some((part) => (groupRoots as readonly string[]).includes(part))
			) {
				selected.set(id, group as CategoryGroup);
				break;
			}
		}
	}
	for (const root of [...roots, ...exclusions]) {
		if (!allIds.has(root))
			throw new Error(`Unknown Overture taxonomy root: ${root}`);
	}
	return { selected, excluded, allIds };
}
