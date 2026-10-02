import { createFileRoute } from "@tanstack/react-router";
import { DiscoveryLayout } from "../components/discovery-layout";
import { MapPlaceholder } from "../components/discovery-placeholders";

export const Route = createFileRoute("/")({
	head: () => ({ meta: [{ title: "Explore the map · Tardis" }] }),
	component: () => (
		<DiscoveryLayout title="Somewhere worth going">
			<MapPlaceholder />
		</DiscoveryLayout>
	),
});
