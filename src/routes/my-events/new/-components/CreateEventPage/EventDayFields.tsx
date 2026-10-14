import {
	Button,
	Checkbox,
	DatePicker,
	Select,
	SelectItem,
	TextField,
	TimeField,
} from "@code-x/lago";
import { parseDate, parseTime } from "@internationalized/date";
import { Trash2 } from "lucide-react";
import type { CreateEventController } from "./CreateEventPage.hooks";
import css from "./CreateEventPage.module.css";
import type { EventDay } from "./CreateEventPage.utils";

type Props = Pick<CreateEventController, "updateDay" | "removeDay"> & {
	day: EventDay;
	index: number;
	canRemove: boolean;
};

export function EventDayFields({
	day,
	index,
	canRemove,
	updateDay,
	removeDay,
}: Props) {
	return (
		<div className={css.day}>
			<div className={css.dayHeading}>
				<h3>Day {index + 1}</h3>
				{canRemove && (
					<Button
						variant="quiet"
						type="button"
						aria-label={`Remove day ${index + 1}`}
						onPress={() => removeDay(day.id)}
					>
						<Trash2 aria-hidden="true" />
					</Button>
				)}
			</div>
			<DatePicker
				label="Date"
				value={day.date ? parseDate(day.date) : null}
				minValue={parseDate("1900-01-01")}
				maxValue={parseDate("2200-12-31")}
				isRequired
				onChange={(value) =>
					updateDay(day.id, { date: value?.toString() ?? "" })
				}
			/>
			<Select
				label={`Hours for day ${index + 1}`}
				selectedKey={day.timeKind}
				onSelectionChange={(key) =>
					updateDay(day.id, { timeKind: key as EventDay["timeKind"] })
				}
			>
				<SelectItem id="timed">Set hours</SelectItem>
				<SelectItem id="all_day">All day</SelectItem>
				<SelectItem id="unknown">Hours to be announced</SelectItem>
			</Select>
			{day.timeKind === "timed" && (
				<div className={css.hours}>
					<div className={css.timeRow}>
						<TimeField
							className={css.timeField}
							label="Start time"
							value={parseTime(day.startsAt)}
							hourCycle={24}
							isRequired
							onChange={(value) => {
								if (value)
									updateDay(day.id, { startsAt: value.toString().slice(0, 5) });
							}}
						/>
						<TimeField
							className={css.timeField}
							label="End time"
							value={parseTime(day.endsAt)}
							hourCycle={24}
							isRequired
							onChange={(value) => {
								if (value)
									updateDay(day.id, { endsAt: value.toString().slice(0, 5) });
							}}
						/>
					</div>
					<Checkbox
						isSelected={day.endsNextDay}
						onChange={(value) => updateDay(day.id, { endsNextDay: value })}
					>
						Ends the next day
					</Checkbox>
				</div>
			)}
			<TextField
				label={`Day ${index + 1} note (optional)`}
				value={day.description}
				onChange={(value) => updateDay(day.id, { description: value })}
			/>
		</div>
	);
}
