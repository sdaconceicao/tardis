import { ToastArea } from "@code-x/lago";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { DiscoveryLayout } from "../../../../components/DiscoveryLayout/DiscoveryLayout";
import { MapView } from "../MapView/MapView";
import { PoiResultsPanel } from "../PoiResultsPanel/PoiResultsPanel";
import { useDiscovery } from "./ExplorePage.hooks";
import { fallbackViewport, type MapSearch, parseMapSearch } from "./map-search";
import "./ExplorePage.module.css";

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
	const {
		items,
		clusters,
		clustersCapped,
		clustersApproximate,
		catalogStatus,
		nextCursor,
		loading,
		error,
		broad,
		loadMore,
		retry,
	} = useDiscovery(viewport, category);
	const changeCategory = useCallback(
		(nextCategory: string) => {
			void navigate({
				to: "/",
				search: parseMapSearch({
					...search,
					category: nextCategory || undefined,
					poi: undefined,
				}),
			});
		},
		[navigate, search],
	);
	const selectPoi = useCallback(
		(id: string) => {
			void navigate({
				to: "/",
				search: parseMapSearch({ ...search, poi: id }),
			});
		},
		[navigate, search],
	);
	const searchBounds = useCallback(
		(bounds: Viewport) => {
			void navigate({
				to: "/",
				search: parseMapSearch({ ...search, ...bounds, poi: undefined }),
			});
		},
		[navigate, search],
	);

	return (
		<>
			<ToastArea />
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
						onCategoryChange={changeCategory}
						selectedId={selectedId}
						onSelect={selectPoi}
						hasMore={nextCursor !== null}
						onLoadMore={loadMore}
						onRetry={retry}
					/>
				}
			>
				<MapView
					viewport={viewport}
					pois={items}
					clusters={clusters}
					selectedId={selectedId}
					onSelect={selectPoi}
					onSearchBounds={searchBounds}
				/>
			</DiscoveryLayout>
		</>
	);
}
