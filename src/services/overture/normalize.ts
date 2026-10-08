import { createHash } from "node:crypto";
import { find } from "geo-tz/dist/find-1970";
import { isLandmarkCandidate } from "./landmark-policy.ts";
import type { CategoryMapping } from "./taxonomy.ts";

export type ExtractedPlace = {
	id: string | null;
	name: string | null;
	latitude: number | null;
	longitude: number | null;
	address: string | null;
	taxonomyPrimary: string | null;
	basicCategory: string | null;
	operatingStatus: string | null;
	confidence: number | null;
};

export type CatalogPlace = {
	externalId: string;
	name: string;
	latitude: number;
	longitude: number;
	address: string | null;
	timezone: string;
	category: string | null;
	taxonomyPrimary: string | null;
	operatingStatus: string | null;
	confidence: number | null;
	contentHash: Buffer;
};

export type Normalized =
	| { value: CatalogPlace; reject?: never }
	| { reject: string; value?: never };

function postgresText(value: string | null): string | null {
	return (
		value
			?.replace(
				/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
				"\uFFFD",
			)
			.replaceAll("\0", "") ?? null
	);
}

export function normalizeOverturePlace(
	input: ExtractedPlace,
	scope: "regional-poi" | "neon-free",
	mapping: CategoryMapping,
	lookup: (latitude: number, longitude: number) => string[] = find,
): Normalized {
	if (
		!input.id ||
		!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
			input.id,
		)
	) {
		return { reject: "invalid_id" };
	}
	const name = postgresText(input.name)?.trim();
	if (!name || name.length > 200) return { reject: "invalid_name" };
	const { latitude, longitude } = input;
	if (
		latitude === null ||
		longitude === null ||
		!Number.isFinite(latitude) ||
		!Number.isFinite(longitude) ||
		latitude < -90 ||
		latitude > 90 ||
		longitude < -180 ||
		longitude > 180
	)
		return { reject: "invalid_point" };
	const taxonomyPrimary = postgresText(input.taxonomyPrimary);
	const basicCategory = postgresText(input.basicCategory);
	const categoryId = taxonomyPrimary ?? basicCategory;
	const category = categoryId
		? (mapping.selected.get(categoryId) ?? null)
		: null;
	if (
		!category ||
		(scope === "neon-free" &&
			category !== "museums" &&
			category !== "entertainment")
	) {
		return { reject: "outside_category_scope" };
	}
	if (!isLandmarkCandidate(category, taxonomyPrimary)) {
		return { reject: "generic_historic_site" };
	}
	const zones = lookup(latitude, longitude);
	if (zones.length !== 1 || !zones[0] || zones[0].startsWith("Etc/GMT")) {
		return { reject: "unresolved_timezone" };
	}
	const address = postgresText(input.address)?.trim() || null;
	const value = {
		externalId: input.id,
		name,
		latitude,
		longitude,
		address,
		timezone: zones[0],
		category,
		taxonomyPrimary,
		operatingStatus: postgresText(input.operatingStatus),
		confidence: input.confidence,
	};
	const contentHash = createHash("sha256")
		.update(JSON.stringify(value))
		.digest();
	return { value: { ...value, contentHash } };
}
