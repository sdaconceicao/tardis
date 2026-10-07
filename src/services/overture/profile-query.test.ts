import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildProfileQuery } from "./profile-query";
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

describe("buildProfileQuery", () => {
	it("limits hosted extraction to the selected museum and entertainment taxonomy", () => {
		const query = buildProfileQuery(
			["https://example.test/place.parquet"],
			"neon-free",
			mapping,
			{ us: "/tmp/us.zip" },
		);
		expect(query).toContain("('museum', 'museums')");
		expect(query).toContain("('movie_theater', 'entertainment')");
		expect(query).not.toContain("('restaurant', 'restaurants')");
		expect(query).not.toContain("('park', 'parks')");
		expect(query).toContain("ST_Covers");
	});

	it("limits the local profile to regional POI groups", () => {
		const query = buildProfileQuery(
			["/tmp/place.parquet"],
			"regional-poi",
			mapping,
			{ countries: "/tmp/countries.zip", regions: "/tmp/regions.zip" },
		);
		expect(query).toContain("('restaurant', 'restaurants')");
		expect(query).toContain("('museum', 'museums')");
		expect(query).toContain("North America");
		expect(query).toContain("Europe");
		expect(query).toContain("ST_Covers");
		expect(query).not.toContain("unclassified");
	});
});
