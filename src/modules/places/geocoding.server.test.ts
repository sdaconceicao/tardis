import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupPoiAddress, searchAddresses } from "./geocoding.server";

const feature = (
	longitude: number,
	latitude: number,
	properties: Record<string, string>,
) => ({ geometry: { coordinates: [longitude, latitude] }, properties });

afterEach(() => {
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

describe("address geocoding", () => {
	it("returns selectable addresses with coordinates and timezone", async () => {
		vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost/test");
		vi.stubEnv("OPENROUTESERVICE_API_KEY", "test-key");
		const fetcher = vi.fn().mockResolvedValue(
			Response.json({
				features: [
					feature(-75.15, 39.95, {
						gid: "openstreetmap:address:1",
						label: "12 Main Street, Philadelphia, PA, USA",
						housenumber: "12",
						street: "Main Street",
						locality: "Philadelphia",
						region: "Pennsylvania",
						postalcode: "19106",
						country: "United States",
					}),
				],
			}),
		);
		vi.stubGlobal("fetch", fetcher);
		const matches = await searchAddresses({
			line1: "12 Main Street",
			line2: "Floor 2",
			city: "Philadelphia",
			region: "Pennsylvania",
			postalCode: "19106",
			country: "United States",
		});
		expect(matches).toMatchObject([
			{
				id: "openstreetmap:address:1",
				address: { line1: "12 Main Street", city: "Philadelphia" },
				latitude: 39.95,
				longitude: -75.15,
				timezone: "America/New_York",
			},
		]);
		const url = fetcher.mock.calls[0][0] as URL;
		expect(url.origin).toBe("https://api.heigit.org");
		expect(url.pathname).toBe("/pelias/v1/search");
		expect(url.searchParams.get("text")).toContain("Floor 2");
	});

	it("does not fill a POI's street from a neighboring house number", async () => {
		vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost/test");
		vi.stubEnv("OPENROUTESERVICE_API_KEY", "test-key");
		const fetcher = vi
			.fn()
			.mockResolvedValueOnce(
				Response.json({
					features: [
						feature(-75.1499, 39.9501, {
							label: "14 Main Street",
							housenumber: "14",
							street: "Main Street",
						}),
					],
				}),
			)
			.mockResolvedValueOnce(
				Response.json({
					features: [
						feature(-75.15, 39.95, {
							street: "Nearby Street",
							locality: "Philadelphia",
							region: "Pennsylvania",
							country: "United States",
						}),
					],
				}),
			);
		vi.stubGlobal("fetch", fetcher);
		expect(
			await lookupPoiAddress({
				latitude: 39.95,
				longitude: -75.15,
				address: "12 Main Street",
			}),
		).toMatchObject({
			line1: "",
			city: "Philadelphia",
			region: "Pennsylvania",
		});
		expect(fetcher).toHaveBeenCalledTimes(2);
	});
});
