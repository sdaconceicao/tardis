import { Button } from "@code-x/lago";
import { CalendarDays } from "lucide-react";
import css from "./DiscoveryToolbar.module.css";

export function DiscoveryToolbar({
	title,
	eyebrow = "The local timetable",
	showDateControl = true,
}: {
	title: string;
	eyebrow?: string;
	showDateControl?: boolean;
}) {
	return (
		<div className={css.discoveryToolbar}>
			<div>
				<p className={css.eyebrow}>{eyebrow}</p>
				<h1 id="discovery-title">{title}</h1>
			</div>
			{showDateControl && (
				<Button variant="secondary" isDisabled>
					<CalendarDays aria-hidden="true" />
					Choose dates
				</Button>
			)}
		</div>
	);
}
