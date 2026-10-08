import { describe, expect, it } from "vitest";
import { loadPinnedPlaceManifest, parsePlaceManifest } from "./manifest";

const url =
	"https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-09-23.1/theme=places/type=place/part-00000-test.parquet";
const item = {
	id: "00000",
	bbox: [-100, 20, -90, 40],
	properties: { num_rows: 3 },
	assets: { aws: { href: url, "file:size": 100 } },
};
const collection = {
	"partition:file_count": 1,
	"table:row_count": 3,
	links: [{ rel: "item", href: "https://stac.overturemaps.org/00000.json" }],
};

describe("parsePlaceManifest", () => {
	it("loads the exact pinned release without a STAC request", async () => {
		const assets = await loadPinnedPlaceManifest();
		expect(assets).toHaveLength(16);
		expect(assets.reduce((sum, asset) => sum + asset.rows, 0)).toBe(81_455_423);
	});
	it("accepts a complete pinned manifest", () => {
		expect(parsePlaceManifest(collection, [item])).toEqual([
			{ id: "00000", url, bbox: item.bbox, rows: 3, bytes: 100 },
		]);
	});

	it("rejects incomplete and mismatched source data", () => {
		expect(() => parsePlaceManifest(collection, [])).toThrow(/Incomplete/);
		expect(() =>
			parsePlaceManifest({ ...collection, "table:row_count": 4 }, [item]),
		).toThrow(/row counts/);
		expect(() =>
			parsePlaceManifest(collection, [
				{
					...item,
					assets: {
						aws: { href: url.replace("2026-09-23.1", "old"), "file:size": 100 },
					},
				},
			]),
		).toThrow(/Unexpected Overture asset URL/);
	});
});
