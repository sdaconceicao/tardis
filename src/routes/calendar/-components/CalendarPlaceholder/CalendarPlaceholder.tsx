import clsx from "clsx";
import { CalendarDays } from "lucide-react";
import css from "./CalendarPlaceholder.module.css";

export type CalendarView = "month" | "week" | "agenda";

export function CalendarPlaceholder({ view }: { view: CalendarView }) {
	return (
		<div
			className={clsx(css.calendarPlaceholder, {
				[css.calendarMonth]: view === "month",
				[css.calendarAgenda]: view === "agenda",
			})}
		>
			{view !== "agenda" && (
				<div className={css.calendarColumnHeadings} aria-hidden="true">
					{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
						<span key={day}>{day}</span>
					))}
				</div>
			)}
			<div className={css.calendarPlaceholderBody}>
				<div className={css.calendarEmpty}>
					<CalendarDays aria-hidden="true" strokeWidth={1.25} />
					<h2>
						{view === "month"
							? "A month of possibilities."
							: view === "week"
								? "Your week, wide open."
								: "Make a little time to explore."}
					</h2>
					<p>
						Your {view === "agenda" ? "daily agenda" : `${view} of events`} will
						appear here.
					</p>
					<span className={css.previewNote}>
						Calendar discovery is coming soon.
					</span>
				</div>
			</div>
		</div>
	);
}
