import { createFileRoute } from "@tanstack/react-router";
import { SavedPage } from "./-components/SavedPage/SavedPage";

export const Route = createFileRoute("/saved")({
	head: () => ({ meta: [{ title: "Saved events & places · Tardis" }] }),
	component: SavedPage,
});
