import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveCategoryMapping } from "./taxonomy";

const csv = readFileSync(
	new URL(
		"../../../config/overture/taxonomy-2026-09-23.0.csv",
		import.meta.url,
	),
	"utf8",
);

describe("resolveCategoryMapping", () => {
	const mapping = resolveCategoryMapping(csv);

	it("resolves exact restaurant descendants without cafes or gas stations", () => {
		expect(mapping.selected.get("pizza_restaurant")).toBe("restaurants");
		expect(mapping.selected.get("fast_food_restaurant")).toBe("restaurants");
		expect(mapping.selected.has("cafe")).toBe(false);
		expect(mapping.selected.has("gas_station")).toBe(false);
		expect(mapping.excluded.has("gas_station")).toBe(true);
	});

	it("includes visitor destinations and excludes offices and parking", () => {
		expect(mapping.selected.get("playground")).toBe("parks");
		expect(mapping.selected.get("botanical_garden")).toBe("parks");
		expect(mapping.selected.get("art_museum")).toBe("museums");
		expect(mapping.selected.get("historic_tower")).toBe("landmarks");
		expect(mapping.selected.get("movie_theater")).toBe("entertainment");
		expect(mapping.selected.has("corporate_or_business_office")).toBe(false);
		expect(mapping.selected.has("parking_lot")).toBe(false);
		expect(mapping.excluded.has("cemetery")).toBe(true);
	});

	it("rejects a changed taxonomy or malformed row", () => {
		expect(() => resolveCategoryMapping(`${csv}changed`)).toThrow(/checksum/);
		expect(() => resolveCategoryMapping("bad\n", "hash")).toThrow(/checksum/);
	});
});
