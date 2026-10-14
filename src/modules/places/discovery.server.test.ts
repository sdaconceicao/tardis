import { drizzle } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";
import { buildPoiSearchQuery, poiSearchQuerySchema } from "./discovery.server";

it("requires at least three characters for indexed POI search", () => {
	expect(poiSearchQuerySchema.safeParse({ q: "ab" }).success).toBe(false);
	expect(poiSearchQuerySchema.safeParse({ q: "abc" }).success).toBe(true);
	expect(
		poiSearchQuerySchema.safeParse({ q: "museum", limit: 21 }).success,
	).toBe(false);
	expect(poiSearchQuerySchema.parse({ q: "museum" })).toEqual({
		q: "museum",
		limit: 10,
	});
});

describe("POI venue search", () => {
	it("uses separate name and address matches and escapes patterns", () => {
		const query = buildPoiSearchQuery(drizzle.mock() as never, {
			q: "100%",
			limit: 10,
		}).toSQL();
		expect(query.sql).toContain(" union ");
		expect(query.sql).toContain('"places"."name" ilike');
		expect(query.sql).toContain('"locations"."address" ilike');
		expect(query.sql).toContain('"places"."management_kind"');
		expect(query.sql).toContain('"places"."visibility"');
		expect(query.sql).toContain("source.state = 'active'");
		expect(query.params).toEqual([
			"catalog",
			"public",
			"%100\\%%",
			"catalog",
			"public",
			"%100\\%%",
			"historic_site",
			10,
		]);
	});
});
