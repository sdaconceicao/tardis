import type { Map as MapLibreMap } from "maplibre-gl";
import { describe, expect, it, vi } from "vitest";
import { darkBasemapColors, styleDarkBasemap } from "./MapView.style";

function luminance(color: string) {
	const channels = color.match(/[0-9a-f]{2}/gi)?.map((part) => {
		const value = Number.parseInt(part, 16) / 255;
		return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
	});
	if (channels?.length !== 3) throw new Error("Expected a hex color");
	return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrast(first: string, second: string) {
	const lighter = Math.max(luminance(first), luminance(second));
	const darker = Math.min(luminance(first), luminance(second));
	return (lighter + 0.05) / (darker + 0.05);
}

describe("dark basemap", () => {
	it("keeps water distinct and small labels legible on land and water", () => {
		expect(
			contrast(darkBasemapColors.water, darkBasemapColors.land),
		).toBeGreaterThanOrEqual(3);
		expect(
			contrast(darkBasemapColors.label, darkBasemapColors.land),
		).toBeGreaterThanOrEqual(4.5);
		expect(
			contrast(darkBasemapColors.label, darkBasemapColors.water),
		).toBeGreaterThanOrEqual(4.5);
		expect(
			contrast(darkBasemapColors.majorRoad, darkBasemapColors.land),
		).toBeGreaterThanOrEqual(3);
		expect(
			contrast(darkBasemapColors.subtleRoad, darkBasemapColors.land),
		).toBeLessThan(
			contrast(darkBasemapColors.minorRoad, darkBasemapColors.land),
		);
		expect(
			contrast(darkBasemapColors.minorRoad, darkBasemapColors.land),
		).toBeLessThan(
			contrast(darkBasemapColors.majorRoad, darkBasemapColors.land),
		);
	});

	it("restyles the provider's water, roads, and text layers", () => {
		const setPaintProperty = vi.fn();
		const setLayoutProperty = vi.fn();
		const map = {
			getStyle: () => ({
				layers: [
					{ id: "background", type: "background" },
					{ id: "water", type: "fill" },
					{ id: "highway_minor", type: "line" },
					{ id: "highway_motorway_subtle", type: "line" },
					{
						id: "place_city",
						type: "symbol",
						layout: { "text-field": ["get", "name"], "text-size": 10 },
					},
				],
			}),
			setPaintProperty,
			setLayoutProperty,
		} as unknown as MapLibreMap;

		styleDarkBasemap(map);

		expect(setPaintProperty).toHaveBeenCalledWith(
			"background",
			"background-color",
			darkBasemapColors.land,
		);
		expect(setPaintProperty).toHaveBeenCalledWith(
			"water",
			"fill-color",
			darkBasemapColors.water,
		);
		expect(setPaintProperty).toHaveBeenCalledWith(
			"highway_minor",
			"line-color",
			darkBasemapColors.minorRoad,
		);
		expect(setPaintProperty).toHaveBeenCalledWith(
			"highway_motorway_subtle",
			"line-color",
			darkBasemapColors.subtleRoad,
		);
		expect(setPaintProperty).toHaveBeenCalledWith(
			"place_city",
			"text-color",
			darkBasemapColors.label,
		);
		expect(setLayoutProperty).toHaveBeenCalledWith(
			"place_city",
			"text-size",
			12,
		);
	});
});
