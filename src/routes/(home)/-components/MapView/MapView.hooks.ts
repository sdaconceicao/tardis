import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Poi, PoiCluster, Viewport } from "../ExplorePage/ExplorePage";
import type { MapViewProps } from "./MapView";
import { styleDarkBasemap } from "./MapView.style";

const lightStyle = "https://tiles.openfreemap.org/styles/liberty";
const darkStyle = "https://tiles.openfreemap.org/styles/dark";

function isDarkMode() {
	return document.documentElement.classList.contains("dark-mode");
}

function styleUrl() {
	return isDarkMode()
		? import.meta.env.VITE_MAP_STYLE_URL_DARK || darkStyle
		: import.meta.env.VITE_MAP_STYLE_URL || lightStyle;
}

function mapColors() {
	const styles = getComputedStyle(document.documentElement);
	const token = (name: string) => styles.getPropertyValue(name).trim();
	return {
		point: token("--atlas-nav"),
		pointText: token("--atlas-nav-text"),
		selected: token("--highlight-background"),
		outline: token("--background-color"),
	};
}

function viewportCenter(viewport: Viewport): [number, number] {
	let longitude =
		viewport.west < viewport.east
			? (viewport.west + viewport.east) / 2
			: (viewport.west + viewport.east + 360) / 2;
	if (longitude > 180) longitude -= 360;
	return [longitude, (viewport.south + viewport.north) / 2];
}

function updateSources(map: MapLibreMap, pois: Poi[], clusters: PoiCluster[]) {
	(map.getSource("poi-points") as GeoJSONSource | undefined)?.setData({
		type: "FeatureCollection",
		features: pois.map((poi) => ({
			type: "Feature",
			geometry: { type: "Point", coordinates: [poi.longitude, poi.latitude] },
			properties: { id: poi.id, name: poi.name },
		})),
	});
	(map.getSource("poi-clusters") as GeoJSONSource | undefined)?.setData({
		type: "FeatureCollection",
		features: clusters.map((cluster) => ({
			type: "Feature",
			geometry: {
				type: "Point",
				coordinates: [cluster.longitude, cluster.latitude],
			},
			properties: cluster,
		})),
	});
}

function updateSelection(
	map: MapLibreMap,
	selectedId: string | null,
	pois: Poi[],
	focusSelection = true,
) {
	if (!map.getLayer("poi-points")) return;
	const colors = mapColors();
	const poi = selectedId
		? pois.find((item) => item.id === selectedId)
		: undefined;
	if (poi && focusSelection) {
		map.easeTo({
			center: [poi.longitude, poi.latitude],
			zoom: Math.max(map.getZoom(), 10),
		});
	}
	map.setPaintProperty(
		"poi-points",
		"circle-color",
		selectedId
			? [
					"case",
					["==", ["get", "id"], selectedId],
					colors.selected,
					colors.point,
				]
			: colors.point,
	);
}

function addPoiLayers(
	map: MapLibreMap,
	pois: Poi[],
	clusters: PoiCluster[],
	selectedId: string | null,
	focusSelection: boolean,
) {
	const colors = mapColors();
	const basemapLabel = map
		.getStyle()
		.layers.find(
			(layer) => layer.type === "symbol" && layer.layout?.["text-font"],
		);
	const textFont = basemapLabel
		? map.getLayoutProperty(basemapLabel.id, "text-font")
		: ["Noto Sans Regular"];
	map.addSource("poi-points", {
		type: "geojson",
		data: { type: "FeatureCollection", features: [] },
	});
	map.addSource("poi-clusters", {
		type: "geojson",
		data: { type: "FeatureCollection", features: [] },
	});
	map.addLayer({
		id: "poi-clusters",
		type: "circle",
		source: "poi-clusters",
		paint: {
			"circle-radius": 18,
			"circle-color": colors.point,
			"circle-stroke-color": colors.outline,
			"circle-stroke-width": 2,
		},
	});
	map.addLayer({
		id: "poi-cluster-count",
		type: "symbol",
		source: "poi-clusters",
		layout: {
			"text-field": ["get", "count"],
			"text-font": textFont,
			"text-size": 12,
		},
		paint: { "text-color": colors.pointText },
	});
	map.addLayer({
		id: "poi-points",
		type: "circle",
		source: "poi-points",
		paint: {
			"circle-radius": 7,
			"circle-color": colors.point,
			"circle-stroke-color": colors.outline,
			"circle-stroke-width": 2,
		},
	});
	updateSources(map, pois, clusters);
	updateSelection(map, selectedId, pois, focusSelection);
}

export function useMapView({
	viewport,
	pois,
	clusters,
	selectedId,
	onSelect,
	onSearchBounds,
}: MapViewProps) {
	const container = useRef<HTMLDivElement>(null);
	const mapRef = useRef<MapLibreMap | null>(null);
	const dataRef = useRef({ pois, clusters });
	const selectedIdRef = useRef(selectedId);
	const viewportRef = useRef(viewport);
	const handlersRef = useRef({ onSelect, onSearchBounds });
	const [failed, setFailed] = useState(false);
	const [ready, setReady] = useState(false);
	const [pending, setPending] = useState(false);
	handlersRef.current = { onSelect, onSearchBounds };
	dataRef.current = { pois, clusters };
	selectedIdRef.current = selectedId;
	viewportRef.current = viewport;

	useEffect(() => {
		const map = mapRef.current;
		if (!map?.isStyleLoaded()) return;
		const center = viewportCenter(viewport);
		const current = map.getCenter();
		if (
			Math.abs(current.lng - center[0]) > 0.001 ||
			Math.abs(current.lat - center[1]) > 0.001 ||
			Math.abs(map.getZoom() - viewport.zoom) > 0.01
		) {
			map.jumpTo({ center, zoom: viewport.zoom });
		}
		setPending(false);
	}, [viewport]);

	useEffect(() => {
		if (mapRef.current) updateSources(mapRef.current, pois, clusters);
	}, [pois, clusters]);

	useEffect(() => {
		const map = mapRef.current;
		if (map) updateSelection(map, selectedId, pois);
	}, [selectedId, pois]);

	useEffect(() => {
		let disposed = false;
		let zoomingToCluster = false;
		let removeMap: (() => void) | undefined;
		let resizeObserver: ResizeObserver | undefined;
		let currentStyle = styleUrl();
		let firstStyleLoad = true;
		const element = container.current;
		if (!element) return;

		Promise.all([
			import("maplibre-gl"),
			import("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"),
		])
			.then(([maplibre, worker]) => {
				if (disposed) return;
				maplibre.setWorkerUrl(worker.default);
				currentStyle = styleUrl();
				const map = new maplibre.Map({
					container: element,
					style: currentStyle,
					center: viewportCenter(viewportRef.current),
					zoom: viewportRef.current.zoom,
				});
				mapRef.current = map;
				const themeObserver = new MutationObserver(() => {
					const nextStyle = styleUrl();
					if (nextStyle === currentStyle) {
						if (!map.getLayer("poi-clusters")) return;
						const colors = mapColors();
						map.setPaintProperty("poi-clusters", "circle-color", colors.point);
						map.setPaintProperty(
							"poi-clusters",
							"circle-stroke-color",
							colors.outline,
						);
						map.setPaintProperty(
							"poi-cluster-count",
							"text-color",
							colors.pointText,
						);
						map.setPaintProperty(
							"poi-points",
							"circle-stroke-color",
							colors.outline,
						);
						updateSelection(
							map,
							selectedIdRef.current,
							dataRef.current.pois,
							false,
						);
						return;
					}
					currentStyle = nextStyle;
					map.setStyle(nextStyle);
				});
				themeObserver.observe(document.documentElement, {
					attributes: true,
					attributeFilter: ["class"],
				});
				removeMap = () => {
					themeObserver.disconnect();
					map.remove();
				};
				map.addControl(new maplibre.NavigationControl(), "top-right");
				map.on("error", () => {
					setFailed(true);
					setReady(true);
				});
				map.on("style.load", () => {
					if (currentStyle === darkStyle) styleDarkBasemap(map);
					const focusSelection = firstStyleLoad;
					if (focusSelection) {
						map.jumpTo({
							center: viewportCenter(viewportRef.current),
							zoom: viewportRef.current.zoom,
						});
						firstStyleLoad = false;
					}
					setFailed(false);
					setReady(true);
					addPoiLayers(
						map,
						dataRef.current.pois,
						dataRef.current.clusters,
						selectedIdRef.current,
						focusSelection,
					);
					setPending(false);
				});
				map.on("moveend", () => {
					const searchAfterZoom =
						(!selectedIdRef.current || zoomingToCluster) &&
						Math.abs(map.getZoom() - viewportRef.current.zoom) > 0.05;
					zoomingToCluster = false;
					if (searchAfterZoom) {
						const bounds = map.getBounds();
						handlersRef.current.onSearchBounds({
							west: bounds.getWest(),
							south: bounds.getSouth(),
							east: bounds.getEast(),
							north: bounds.getNorth(),
							zoom: map.getZoom(),
						});
						setPending(false);
					} else {
						setPending(true);
					}
				});
				map.on("click", "poi-points", (event) => {
					const ids = [
						...new Set(
							(event.features ?? [])
								.map((feature) => feature.properties?.id)
								.filter((id): id is string => typeof id === "string"),
						),
					];
					if (ids.length) {
						const current = ids.indexOf(selectedIdRef.current ?? "");
						handlersRef.current.onSelect(ids[(current + 1) % ids.length]);
					}
				});
				map.on("click", "poi-clusters", (event) => {
					const cluster = event.features?.[0]?.properties;
					if (cluster) {
						zoomingToCluster = true;
						map.easeTo({
							center: [Number(cluster.longitude), Number(cluster.latitude)],
							zoom: map.getZoom() + 2,
						});
					}
				});
				resizeObserver = new ResizeObserver(() => map.resize());
				resizeObserver.observe(element);
			})
			.catch(() => {
				if (!disposed) {
					setFailed(true);
					setReady(true);
				}
			});

		return () => {
			disposed = true;
			resizeObserver?.disconnect();
			removeMap?.();
			mapRef.current = null;
		};
	}, []);

	const searchArea = useCallback(() => {
		const map = mapRef.current;
		if (!map) return;
		const bounds = map.getBounds();
		onSearchBounds({
			west: bounds.getWest(),
			south: bounds.getSouth(),
			east: bounds.getEast(),
			north: bounds.getNorth(),
			zoom: map.getZoom(),
		});
		setPending(false);
	}, [onSearchBounds]);

	return { container, failed, ready, pending, searchArea };
}
