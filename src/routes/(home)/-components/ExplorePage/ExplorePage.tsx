import { DiscoveryLayout } from "../../../../components/DiscoveryLayout/DiscoveryLayout";
import { MapPlaceholder } from "../MapPlaceholder/MapPlaceholder";

export function ExplorePage() {
	return (
		<DiscoveryLayout title="Somewhere worth going">
			<MapPlaceholder />
		</DiscoveryLayout>
	);
}
