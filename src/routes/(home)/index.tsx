import { createFileRoute } from "@tanstack/react-router";
import { ExplorePage } from "./-components/ExplorePage/ExplorePage";

export const Route = createFileRoute("/(home)/")({
	head: () => ({ meta: [{ title: "Explore the map · Tardis" }] }),
	component: ExplorePage,
});
