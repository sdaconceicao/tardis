import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { hostedCapacityReserve } from "./capacity.ts";
import { resolveOvertureSyncConfig } from "./config.ts";
import type { PlaceAsset } from "./manifest.ts";

const config = resolveOvertureSyncConfig({
	OVERTURE_SYNC_PROFILE: "neon-free",
	OVERTURE_DEPLOYMENT_TARGET: "hosted",
	DATABASE_URL: "postgresql://example:example@ep-example.neon.tech/tardis",
});

async function manifest(): Promise<PlaceAsset[]> {
	return JSON.parse(
		await readFile(
			new URL(
				"../../../config/overture/manifest-2026-09-23.1.json",
				import.meta.url,
			),
			"utf8",
		),
	) as PlaceAsset[];
}

describe("hosted capacity gate", () => {
	it("accepts the measured release with a 20 percent storage reserve", async () => {
		expect(await hostedCapacityReserve(await manifest(), config)).toEqual({
			reservedBytes: 133_622_976,
			sourceRows: 154_464,
		});
	});

	it("rejects a changed source manifest before writes", async () => {
		const assets = await manifest();
		assets[0] = { ...assets[0], rows: assets[0].rows + 1 };
		await expect(hostedCapacityReserve(assets, config)).rejects.toThrow(
			"does not match this release and selection",
		);
	});
});
