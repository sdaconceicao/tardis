import { AppLink } from "../../../../components/AppLink/AppLink";
import { DiscoveryLayout } from "../../../../components/DiscoveryLayout/DiscoveryLayout";
import {
	CalendarPlaceholder,
	type CalendarView,
} from "../CalendarPlaceholder/CalendarPlaceholder";
import css from "./CalendarPage.module.css";

export function CalendarPage({ view }: { view: CalendarView }) {
	return (
		<DiscoveryLayout
			title="Time for something good"
			navigation={
				<nav className={css.calendarNavigation} aria-label="Calendar view">
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
