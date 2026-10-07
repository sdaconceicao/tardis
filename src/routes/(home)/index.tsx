import { createFileRoute } from "@tanstack/react-router";
import mapCss from "maplibre-gl/dist/maplibre-gl.css?url";
import { ExplorePage } from "./-components/ExplorePage/ExplorePage";
import { parseMapSearch } from "./-components/ExplorePage/map-search";

export const Route = createFileRoute("/(home)/")({
	validateSearch: parseMapSearch,
	head: () => ({
		meta: [{ title: "Explore the map · Tardis" }],
		links: [{ rel: "stylesheet", href: mapCss }],
	}),
	component: () => <ExplorePage search={Route.useSearch()} />,
});
