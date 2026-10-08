import { Button } from "@code-x/lago";
import type { Poi, PoiCluster, Viewport } from "../ExplorePage/ExplorePage";
import { useMapView } from "./MapView.hooks";
import css from "./MapView.module.css";

export type MapViewProps = {
	viewport: Viewport;
	pois: Poi[];
	clusters: PoiCluster[];
	selectedId: string | null;
	onSelect(id: string): void;
	onSearchBounds(viewport: Viewport): void;
};

export function MapView(props: MapViewProps) {
	const { container, failed, ready, pending, searchArea } = useMapView(props);

	return (
		<section
			className={css.mapView}
			aria-label="Explore map"
			aria-busy={!ready}
		>
			<div className={css.mapCanvas} ref={container} />
			{pending && (
				<Button
					variant="secondary"
					className={css.searchArea}
					onPress={searchArea}
				>
					Search this area
				</Button>
			)}
			{failed && (
				<output className={css.mapError}>
					Map tiles are unavailable. Browse places in the results list.
				</output>
			)}
		</section>
	);
}
