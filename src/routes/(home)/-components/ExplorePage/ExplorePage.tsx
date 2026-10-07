import { useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { DiscoveryLayout } from "../../../../components/DiscoveryLayout/DiscoveryLayout";
import { MapView } from "../MapView/MapView";
import { PoiResultsPanel } from "../PoiResultsPanel/PoiResultsPanel";
import { fallbackViewport, type MapSearch, parseMapSearch } from "./map-search";

export type Viewport = {
	west: number;
	south: number;
	east: number;
	north: number;
	zoom: number;
};
export type Poi = {
	id: string;
	name: string;
	latitude: number;
	longitude: number;
	address: string | null;
	category: string | null;
	sourceRelease: string | null;
	source: string;
	hoursState: "unknown";
};
export type PoiCluster = {
	cellX: number;
	cellY: number;
	count: number;
	latitude: number;
	longitude: number;
	west: number;
	east: number;
	south: number;
	north: number;
};
export type CatalogStatus = "empty" | "importing" | "ready";

export function ExplorePage({ search }: { search: MapSearch }) {
	const navigate = useNavigate();
	const viewport = useMemo<Viewport>(
		() => ({
			west: search.west ?? fallbackViewport.west,
			south: search.south ?? fallbackViewport.south,
			east: search.east ?? fallbackViewport.east,
			north: search.north ?? fallbackViewport.north,
			zoom: search.zoom ?? fallbackViewport.zoom,
		}),
		[search.west, search.south, search.east, search.north, search.zoom],
	);
	const category = search.category ?? "";
	const selectedId = search.poi ?? null;
	const [items, setItems] = useState<Poi[]>([]);
	const [clusters, setClusters] = useState<PoiCluster[]>([]);
	const [clustersCapped, setClustersCapped] = useState(false);
	const [clustersApproximate, setClustersApproximate] = useState(false);
	const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>("empty");
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [retryCount, setRetryCount] = useState(0);
	const loadMoreController = useRef<AbortController | null>(null);
	const broad = viewport.zoom < 8;

	useEffect(() => {
		loadMoreController.current?.abort();
		const controller = new AbortController();
		const params = new URLSearchParams({
			west: String(viewport.west),
			south: String(viewport.south),
			east: String(viewport.east),
			north: String(viewport.north),
		});
		if (category) params.set("category", category);
		const path = broad ? "/api/v1/discovery/clusters" : "/api/v1/discovery";
		if (broad) params.set("zoom", String(Math.floor(viewport.zoom)));
		setLoading(true);
		setError(false);
		fetch(`${path}?${params}`, {
			signal: controller.signal,
			cache: retryCount === 0 ? "default" : "no-store",
		})
			.then(async (response) => {
				if (!response.ok)
					throw new Error(`Discovery returned ${response.status}`);
				return response.json();
			})
			.then((data) => {
				setCatalogStatus(data.catalogStatus);
				if (broad) {
					setClusters(data.clusters);
					setClustersCapped(Boolean(data.capped));
					setClustersApproximate(Boolean(data.approximate));
					setItems([]);
					setNextCursor(null);
				} else {
					setItems(data.items);
					setClusters([]);
					setClustersCapped(false);
					setClustersApproximate(false);
					setNextCursor(data.nextCursor);
				}
				setLoading(false);
			})
			.catch(() => {
				if (!controller.signal.aborted) {
					setError(true);
					setLoading(false);
				}
			});
		return () => {
			controller.abort();
			loadMoreController.current?.abort();
		};
	}, [viewport, category, broad, retryCount]);

	async function loadMore() {
		if (!nextCursor || loading || broad) return;
		const controller = new AbortController();
		loadMoreController.current = controller;
		setLoading(true);
		try {
			const params = new URLSearchParams({
				west: String(viewport.west),
				south: String(viewport.south),
				east: String(viewport.east),
				north: String(viewport.north),
				cursor: nextCursor,
			});
			if (category) params.set("category", category);
			const response = await fetch(`/api/v1/discovery?${params}`, {
				signal: controller.signal,
			});
			if (!response.ok)
				throw new Error(`Discovery returned ${response.status}`);
			const data = await response.json();
			setItems((previous) => [...previous, ...data.items]);
			setNextCursor(data.nextCursor);
			setCatalogStatus(data.catalogStatus);
		} catch {
			if (!controller.signal.aborted) setError(true);
		} finally {
			if (loadMoreController.current === controller) {
				loadMoreController.current = null;
				setLoading(false);
			}
		}
	}

	return (
		<DiscoveryLayout
			title="Somewhere worth going"
			eyebrow="Explore places"
			showDateControl={false}
			metaLeft="Points of interest"
			metaRight="Explore by area"
			results={
				<PoiResultsPanel
					items={items}
					clusters={clusters}
					clustersCapped={clustersCapped}
					clustersApproximate={clustersApproximate}
					catalogStatus={catalogStatus}
					broad={broad}
					loading={loading}
					error={error}
					category={category}
					onCategoryChange={(nextCategory) => {
						void navigate({
							to: "/",
							search: parseMapSearch({
								...search,
								category: nextCategory || undefined,
								poi: undefined,
							}),
						});
					}}
					selectedId={selectedId}
					onSelect={(id) => {
						void navigate({
							to: "/",
							search: parseMapSearch({ ...search, poi: id }),
						});
					}}
					hasMore={nextCursor !== null}
					onLoadMore={loadMore}
					onRetry={() => setRetryCount((count) => count + 1)}
				/>
			}
		>
			<MapView
				viewport={viewport}
				pois={items}
				clusters={clusters}
				selectedId={selectedId}
				onSelect={(id) => {
					void navigate({
						to: "/",
						search: parseMapSearch({ ...search, poi: id }),
					});
				}}
				onSearchBounds={(bounds) => {
					void navigate({
						to: "/",
						search: parseMapSearch({ ...search, ...bounds, poi: undefined }),
					});
				}}
			/>
		</DiscoveryLayout>
	);
}
