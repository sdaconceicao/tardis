import { CalendarDays, Compass } from "lucide-react";

export function MapPlaceholder() {
	return (
		<div className="map-placeholder">
			<span className="map-label">
				United States <span aria-hidden="true">·</span> Map preview
			</span>
			<div className="map-compass" aria-hidden="true">
				<span>N</span>
				<Compass strokeWidth={1} />
			</div>
			<div className="map-placeholder-message">
				<p className="eyebrow">Room to roam</p>
				<h2>Find your next destination.</h2>
				<p>The map will bring events and places together here.</p>
				<span className="preview-note">Map discovery is coming soon.</span>
			</div>
		</div>
	);
}

export function CalendarPlaceholder({
	view,
}: {
	view: "month" | "week" | "agenda";
}) {
	return (
		<div className={`calendar-placeholder calendar-${view}`}>
			{view !== "agenda" && (
				<div className="calendar-column-headings" aria-hidden="true">
					{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
						<span key={day}>{day}</span>
					))}
				</div>
			)}
			<div className="calendar-placeholder-body">
				<div className="calendar-empty">
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
					<span className="preview-note">
						Calendar discovery is coming soon.
					</span>
				</div>
			</div>
		</div>
	);
}
