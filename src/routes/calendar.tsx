import { createFileRoute } from "@tanstack/react-router";
import { AppLink } from "../components/app-shell";
import { DiscoveryLayout } from "../components/discovery-layout";
import { CalendarPlaceholder } from "../components/discovery-placeholders";

export const Route = createFileRoute("/calendar")({
	validateSearch: (search): { view: "month" | "week" | "agenda" } => ({
		view:
			search.view === "month" || search.view === "agenda"
				? search.view
				: "week",
	}),
	head: () => ({ meta: [{ title: "Explore the calendar · Tardis" }] }),
	component: CalendarPage,
});

function CalendarPage() {
	const { view } = Route.useSearch();
	return (
		<DiscoveryLayout
			title="Time for something good"
			navigation={
				<nav className="calendar-navigation" aria-label="Calendar view">
					{(["month", "week", "agenda"] as const).map((mode) => (
						<AppLink
							key={mode}
							to="/calendar"
							search={{ view: mode }}
							activeOptions={{ exact: true, includeSearch: true }}
						>
							{mode}
						</AppLink>
					))}
				</nav>
			}
		>
			<CalendarPlaceholder view={view} />
		</DiscoveryLayout>
	);
}
