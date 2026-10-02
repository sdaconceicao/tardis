import { Button } from "@code-x/lago";
import { CalendarDays } from "lucide-react";
import css from "./DiscoveryToolbar.module.css";

export function DiscoveryToolbar({ title }: { title: string }) {
	return (
		<div className={css.discoveryToolbar}>
			<div>
				<p className={css.eyebrow}>The local timetable</p>
				<h1 id="discovery-title">{title}</h1>
			</div>
			<Button variant="secondary" isDisabled>
				<CalendarDays aria-hidden="true" />
				Choose dates
			</Button>
		</div>
	);
}
