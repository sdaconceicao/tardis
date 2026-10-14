import {
	Checkbox,
	CheckboxGroup,
	DatePicker,
	NumberField,
	Select,
	SelectItem,
} from "@code-x/lago";
import { parseDate } from "@internationalized/date";
import type { CreateEventController } from "./CreateEventPage.hooks";
import css from "./CreateEventPage.module.css";
import type { Draft } from "./CreateEventPage.utils";

type Props = Pick<
	CreateEventController,
	"draft" | "update" | "firstDate" | "weekdays"
>;
const weekDays = [
	["MO", "Mon"],
	["TU", "Tue"],
	["WE", "Wed"],
	["TH", "Thu"],
	["FR", "Fri"],
	["SA", "Sat"],
	["SU", "Sun"],
] as const;
const intervalUnits = {
	DAILY: "Days",
	WEEKLY: "Weeks",
	MONTHLY: "Months",
	YEARLY: "Years",
};

export function EventRecurrenceFields({
	draft,
	update,
	firstDate,
	weekdays,
}: Props) {
	return (
		<section className={css.panel} aria-labelledby="repeat-heading">
			<h2 id="repeat-heading">Repeat</h2>
			<Select
				label="Recurrence"
				selectedKey={draft.recurrence}
				onSelectionChange={(key) =>
					update("recurrence", key as Draft["recurrence"])
				}
			>
				<SelectItem id="once">One time</SelectItem>
				<SelectItem id="scheduled">Repeat on a schedule</SelectItem>
				<SelectItem id="expected">
					Expected to return, dates not announced
				</SelectItem>
			</Select>
			{draft.recurrence === "scheduled" && (
				<>
					<Select
						label="Frequency"
						selectedKey={draft.frequency}
						onSelectionChange={(key) =>
							update("frequency", key as Draft["frequency"])
						}
					>
						<SelectItem id="DAILY">Daily</SelectItem>
						<SelectItem id="WEEKLY">Weekly</SelectItem>
						<SelectItem id="MONTHLY">Monthly</SelectItem>
						<SelectItem id="YEARLY">Yearly</SelectItem>
					</Select>
					<NumberField
						label="Repeat every"
						description={intervalUnits[draft.frequency]}
						minValue={1}
						maxValue={100}
						step={1}
						value={draft.interval}
						onChange={(value) => update("interval", value)}
						isRequired
					/>
					{draft.frequency === "WEEKLY" && (
						<CheckboxGroup
							label="Repeat on"
							orientation="horizontal"
							value={weekdays}
							onChange={(value) => update("weekdays", value)}
						>
							{weekDays.map(([code, label]) => (
								<Checkbox key={code} value={code}>
									{label}
								</Checkbox>
							))}
						</CheckboxGroup>
					)}
					<DatePicker
						label="Last start date (optional)"
						value={draft.untilDate ? parseDate(draft.untilDate) : null}
						minValue={parseDate(firstDate || "1900-01-01")}
						maxValue={parseDate("2200-12-31")}
						onChange={(value) => update("untilDate", value?.toString() ?? "")}
					/>
					<p className={css.hint}>
						Each edition follows the first date's weekday or calendar date. The
						event days repeat together.
					</p>
				</>
			)}
			{draft.recurrence === "expected" && (
				<>
					<NumberField
						label="Expected every"
						description="Months"
						minValue={1}
						maxValue={1200}
						step={1}
						value={draft.expectedMonths}
						onChange={(value) => update("expectedMonths", value)}
						isRequired
					/>
					<p className={css.hint}>
						The next edition appears as an unconfirmed month. Exact dates and
						hours are not copied until they are announced.
					</p>
				</>
			)}
		</section>
	);
}
