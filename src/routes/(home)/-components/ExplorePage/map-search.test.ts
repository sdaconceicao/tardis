import { describe, expect, it } from "vitest";
import { parseMapSearch } from "./map-search";

describe("map search state", () => {
	it("accepts a shareable antimeridian viewport and POI selection", () => {
		expect(
			parseMapSearch({
				west: "170",
				south: "40",
				east: "-170",
				north: "60",
				zoom: "9",
				category: "museums",
				poi: "3c85cd80-adb3-4fee-9350-aeaa7cb826a1",
			}),
		).toEqual({
			west: 170,
			south: 40,
			east: -170,
			north: 60,
			zoom: 9,
			category: "museums",
			poi: "3c85cd80-adb3-4fee-9350-aeaa7cb826a1",
		});
	});

	it("drops invalid map search state", () => {
		expect(parseMapSearch({ west: "-70", east: "-70" })).toEqual({});
		expect(parseMapSearch({ category: "gas_stations" })).toEqual({});
	});
});
