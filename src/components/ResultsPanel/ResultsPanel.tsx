import { Button, Skeleton } from "@code-x/lago";
import { MapPin } from "lucide-react";
import css from "./ResultsPanel.module.css";

export function ResultsPanel() {
	return (
		<aside className={css.resultsPanel} aria-label="Events and places">
			<p className={css.eyebrow}>Your destination</p>
			<h2>United States</h2>
			<p className={css.secondaryCopy}>A place to start. A day to discover.</p>
			<Button variant="secondary" isDisabled className={css.locationControl}>
				<MapPin aria-hidden="true" />
				Choose an area
			</Button>
			{["Events", "Places to visit"].map((section) => (
				<section className={css.resultSection} key={section}>
					<h3>{section}</h3>
					<p className={css.secondaryCopy}>
						{section === "Events"
							? "Upcoming events will appear here."
							: "Places to explore will appear here."}
					</p>
					<Skeleton.Paragraph
						className={css.listingPlaceholder}
						lines={3}
						edges="straight"
					/>
					<Skeleton.Paragraph
						className={css.listingPlaceholder}
						lines={3}
						edges="straight"
					/>
				</section>
			))}
			<p className={css.previewNote}>Listings are not connected yet.</p>
		</aside>
	);
}
