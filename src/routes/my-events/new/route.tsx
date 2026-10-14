import { createFileRoute } from "@tanstack/react-router";
import { CreateEventPage } from "./-components/CreateEventPage/CreateEventPage";

export const Route = createFileRoute("/my-events/new")({
	head: () => ({ meta: [{ title: "Create Event · Tardis" }] }),
	component: CreateEventPage,
});
