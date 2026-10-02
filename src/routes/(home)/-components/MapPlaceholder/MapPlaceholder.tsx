import { Compass } from "lucide-react";
import css from "./MapPlaceholder.module.css";

export function MapPlaceholder() {
	return (
		<div className={css.mapPlaceholder}>
			<span className={css.mapLabel}>
				United States <span aria-hidden="true">·</span> Map preview
			</span>
			<div className={css.mapCompass} aria-hidden="true">
				<span>N</span>
				<Compass strokeWidth={1} />
			</div>
			<div className={css.mapPlaceholderMessage}>
				<p className={css.eyebrow}>Room to roam</p>
				<h2>Find your next destination.</h2>
				<p>The map will bring events and places together here.</p>
				<span className={css.previewNote}>Map discovery is coming soon.</span>
			</div>
		</div>
	);
}
