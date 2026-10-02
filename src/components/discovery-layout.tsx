import { Button } from "@code-x/lago";
import { CalendarDays, MapPin } from "lucide-react";
import type { ReactNode } from "react";

function ResultsPlaceholder() {
	return (
		<aside className="results-panel" aria-label="Events and places">
			<p className="eyebrow">Your destination</p>
			<h2>United States</h2>
			<p className="secondary-copy">A place to start. A day to discover.</p>
			<Button variant="secondary" isDisabled className="location-control">
				<MapPin aria-hidden="true" />
				Choose an area
			</Button>
			{["Events", "Places to visit"].map((section) => (
				<section className="result-section" key={section}>
					<h3>{section}</h3>
					<p className="secondary-copy">
						{section === "Events"
							? "Upcoming events will appear here."
							: "Places to explore will appear here."}
					</p>
					<div className="listing-placeholder" aria-hidden="true">
						<span />
						<span />
						<span />
					</div>
					<div className="listing-placeholder" aria-hidden="true">
						<span />
						<span />
						<span />
					</div>
				</section>
			))}
			<p className="preview-note">Listings are not connected yet.</p>
		</aside>
	);
}

export function DiscoveryLayout({
	title,
	children,
	navigation,
}: {
	title: string;
	children: ReactNode;
	navigation?: ReactNode;
}) {
	return (
		<div className="discovery-layout">
			<ResultsPlaceholder />
			<section className="discovery-main" aria-labelledby="discovery-title">
				<div className="discovery-toolbar">
					<div>
						<p className="eyebrow">The local timetable</p>
						<h1 id="discovery-title">{title}</h1>
					</div>
					<Button variant="secondary" isDisabled>
						<CalendarDays aria-hidden="true" />
						Choose dates
					</Button>
				</div>
				<div className="discovery-meta">
					<span>Public events & places</span>
					<span>All regions</span>
				</div>
				{navigation}
				{children}
			</section>
		</div>
	);
}
