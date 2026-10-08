import type { Map as MapLibreMap } from "maplibre-gl";

export const darkBasemapColors = {
	land: "#14262c",
	water: "#277783",
	label: "#fff7e6",
	subtleRoad: "#355057",
	minorRoad: "#4c6870",
	majorRoad: "#5b777e",
	roadCasing: "#30474f",
	park: "#23433a",
	building: "#1d343d",
};

export function styleDarkBasemap(map: MapLibreMap) {
	for (const layer of map.getStyle().layers) {
		if (layer.type === "background") {
			map.setPaintProperty(
				layer.id,
				"background-color",
				darkBasemapColors.land,
			);
		} else if (layer.id === "water" && layer.type === "fill") {
			map.setPaintProperty(layer.id, "fill-color", darkBasemapColors.water);
		} else if (layer.id === "waterway" && layer.type === "line") {
			map.setPaintProperty(layer.id, "line-color", darkBasemapColors.water);
		} else if (layer.id === "landuse_park" && layer.type === "fill") {
			map.setPaintProperty(layer.id, "fill-color", darkBasemapColors.park);
		} else if (layer.id === "building" && layer.type === "fill") {
			map.setPaintProperty(layer.id, "fill-color", darkBasemapColors.building);
		} else if (layer.type === "line" && layer.id.startsWith("highway_")) {
			const color = layer.id.endsWith("_subtle")
				? darkBasemapColors.subtleRoad
				: layer.id.endsWith("_casing")
					? darkBasemapColors.roadCasing
					: layer.id.includes("major") || layer.id.includes("motorway")
						? darkBasemapColors.majorRoad
						: darkBasemapColors.minorRoad;
			map.setPaintProperty(layer.id, "line-color", color);
		} else if (layer.type === "line" && layer.id.startsWith("boundary_")) {
			map.setPaintProperty(
				layer.id,
				"line-color",
				darkBasemapColors.subtleRoad,
			);
		}

		if (layer.type === "symbol" && layer.layout?.["text-field"] !== undefined) {
			map.setPaintProperty(layer.id, "text-color", darkBasemapColors.label);
			map.setPaintProperty(layer.id, "text-halo-color", darkBasemapColors.land);
			map.setPaintProperty(layer.id, "text-halo-width", 1.25);
			map.setPaintProperty(layer.id, "text-halo-blur", 0);
			map.setPaintProperty(layer.id, "text-opacity", 1);
			const textSize = layer.layout?.["text-size"];
			if (typeof textSize === "number" && textSize < 12) {
				map.setLayoutProperty(layer.id, "text-size", 12);
			}
		}
	}
}
