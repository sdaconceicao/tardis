import { createFileRoute } from "@tanstack/react-router";
import { CalendarPage } from "./-components/CalendarPage/CalendarPage";

export const Route = createFileRoute("/calendar")({
	validateSearch: (search): { view: "month" | "week" | "agenda" } => ({
		view:
			search.view === "month" || search.view === "agenda"
				? search.view
				: "week",
	}),
	head: () => ({ meta: [{ title: "Explore the calendar · Tardis" }] }),
	component: () => <CalendarPage view={Route.useSearch().view} />,
});
