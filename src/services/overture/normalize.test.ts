import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type ExtractedPlace, normalizeOverturePlace } from "./normalize";
import { resolveCategoryMapping } from "./taxonomy";

const mapping = resolveCategoryMapping(
	readFileSync(
		new URL(
			"../../../config/overture/taxonomy-2026-09-23.0.csv",
			import.meta.url,
		),
		"utf8",
	),
);
const museum: ExtractedPlace = {
	id: "fc715ad3-9ed4-4a6f-b620-247849167482",
	name: "Art Museum",
	latitude: 40.7,
	longitude: -74,
	address: null,
	taxonomyPrimary: "art_museum",
	basicCategory: "museum",
	operatingStatus: "open",
	confidence: 0.9,
};

describe("normalizeOverturePlace", () => {
	it("accepts a selected POI with an offline timezone and stable hash", () => {
		const first = normalizeOverturePlace(museum, "neon-free", mapping);
		expect(first.value?.timezone).toBe("America/New_York");
		expect(first.value?.category).toBe("museums");
		expect(first.value?.contentHash).toEqual(
			normalizeOverturePlace(museum, "neon-free", mapping).value?.contentHash,
		);
	});

	it("keeps only mapped POI groups in the regional scope", () => {
		const unknown = {
			...museum,
			taxonomyPrimary: "unknown_future_category",
			basicCategory: null,
		};
		expect(
			normalizeOverturePlace(unknown, "regional-poi", mapping).reject,
		).toBe("outside_category_scope");
		expect(normalizeOverturePlace(unknown, "neon-free", mapping).reject).toBe(
			"outside_category_scope",
		);
		expect(
			normalizeOverturePlace(
				{ ...museum, taxonomyPrimary: "restaurant" },
				"regional-poi",
				mapping,
			).value?.category,
		).toBe("restaurants");
	});

	it("removes PostgreSQL-incompatible characters from source text", () => {
		const result = normalizeOverturePlace(
			{
				...museum,
				name: "Art\0 Museum",
				address: "123 Main\0 Street",
				operatingStatus: "open\uD800",
			},
			"regional-poi",
			mapping,
		);
		expect(result.value?.name).toBe("Art Museum");
		expect(result.value?.address).toBe("123 Main Street");
		expect(result.value?.operatingStatus).toBe("open\uFFFD");
	});

	it("quarantines invalid points, names, identities, and ambiguous timezones", () => {
		expect(
			normalizeOverturePlace({ ...museum, id: "bad" }, "regional-poi", mapping)
				.reject,
		).toBe("invalid_id");
		expect(
			normalizeOverturePlace({ ...museum, name: " " }, "regional-poi", mapping)
				.reject,
		).toBe("invalid_name");
		expect(
			normalizeOverturePlace(
				{ ...museum, latitude: null },
				"regional-poi",
				mapping,
			).reject,
		).toBe("invalid_point");
		expect(
			normalizeOverturePlace(museum, "regional-poi", mapping, () => ["A", "B"])
				.reject,
		).toBe("unresolved_timezone");
	});
});
