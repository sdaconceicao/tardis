import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Poi, PoiCluster, Viewport } from "../ExplorePage/ExplorePage";
import type { MapViewProps } from "./MapView";

const fallbackStyle = "https://tiles.openfreemap.org/styles/liberty";

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
) {
	if (!map.getLayer("poi-points")) return;
	const poi = selectedId
		? pois.find((item) => item.id === selectedId)
		: undefined;
	if (poi) {
		map.easeTo({
			center: [poi.longitude, poi.latitude],
			zoom: Math.max(map.getZoom(), 10),
		});
	}
	map.setPaintProperty(
		"poi-points",
		"circle-color",
		selectedId
			? ["case", ["==", ["get", "id"], selectedId], "#f59e0b", "#2563eb"]
			: "#2563eb",
	);
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
		const element = container.current;
		if (!element) return;

		Promise.all([
			import("maplibre-gl"),
			import("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"),
		])
			.then(([maplibre, worker]) => {
				if (disposed) return;
				maplibre.setWorkerUrl(worker.default);
				const map = new maplibre.Map({
					container: element,
					style: import.meta.env.VITE_MAP_STYLE_URL || fallbackStyle,
					center: viewportCenter(viewportRef.current),
					zoom: viewportRef.current.zoom,
				});
				mapRef.current = map;
				removeMap = () => map.remove();
				map.addControl(new maplibre.NavigationControl(), "top-right");
				map.on("error", () => {
					setFailed(true);
					setReady(true);
				});
				map.on("load", () => {
					map.jumpTo({
						center: viewportCenter(viewportRef.current),
						zoom: viewportRef.current.zoom,
					});
					setFailed(false);
					setReady(true);
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
							"circle-color": "#174d6b",
							"circle-stroke-color": "#ffffff",
							"circle-stroke-width": 2,
						},
					});
					map.addLayer({
						id: "poi-cluster-count",
						type: "symbol",
						source: "poi-clusters",
						layout: {
							"text-field": ["get", "count"],
							"text-size": 12,
						},
						paint: { "text-color": "#ffffff" },
					});
					map.addLayer({
						id: "poi-points",
						type: "circle",
						source: "poi-points",
						paint: {
							"circle-radius": 7,
							"circle-color": "#2563eb",
							"circle-stroke-color": "#ffffff",
							"circle-stroke-width": 2,
						},
					});
					updateSources(map, dataRef.current.pois, dataRef.current.clusters);
					updateSelection(map, selectedIdRef.current, dataRef.current.pois);
					setPending(false);
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
