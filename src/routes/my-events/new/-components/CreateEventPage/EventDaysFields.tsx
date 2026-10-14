import { Button } from "@code-x/lago";
import { Plus } from "lucide-react";
import type { CreateEventController } from "./CreateEventPage.hooks";
import css from "./CreateEventPage.module.css";
import { EventDayFields } from "./EventDayFields";

type Props = Pick<
	CreateEventController,
	"draft" | "updateDay" | "addDay" | "removeDay"
>;

export function EventDaysFields({
	draft,
	updateDay,
	addDay,
	removeDay,
}: Props) {
	return (
		<section className={css.panel} aria-labelledby="days-heading">
			<h2 id="days-heading">Dates and hours</h2>
			<p>
				Each day has one continuous time window. Add another day for a multi-day
				event.
			</p>
			{draft.days.map((day, index) => (
				<EventDayFields
					key={day.id}
					day={day}
					index={index}
					canRemove={draft.days.length > 1}
					updateDay={updateDay}
					removeDay={removeDay}
				/>
			))}
			<Button variant="secondary" type="button" onPress={addDay}>
				<Plus aria-hidden="true" /> Add day
			</Button>
		</section>
	);
}
