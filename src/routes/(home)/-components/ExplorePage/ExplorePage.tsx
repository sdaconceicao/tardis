import { DiscoveryLayout } from "../../../../components/DiscoveryLayout/DiscoveryLayout";
import { MapView } from "../MapView/MapView";

export function ExplorePage() {
	return (
		<DiscoveryLayout title="Somewhere worth going">
			<MapView />
		</DiscoveryLayout>
	);
}
