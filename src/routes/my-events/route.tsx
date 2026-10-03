import { createFileRoute } from "@tanstack/react-router";
import { MyEventsPage } from "./-components/MyEventsPage/MyEventsPage";

export const Route = createFileRoute("/my-events")({
	head: () => ({ meta: [{ title: "My events · Tardis" }] }),
	component: MyEventsPage,
});
