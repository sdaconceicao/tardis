import { createFileRoute } from "@tanstack/react-router";
import mapCss from "maplibre-gl/dist/maplibre-gl.css?url";
import { ExplorePage } from "./-components/ExplorePage/ExplorePage";

export const Route = createFileRoute("/(home)/")({
	head: () => ({
		meta: [{ title: "Explore the map · Tardis" }],
		links: [{ rel: "stylesheet", href: mapCss }],
	}),
	component: ExplorePage,
});
