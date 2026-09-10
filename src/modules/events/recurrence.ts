import { RRule } from "rrule";
import { addDays, containsTime, dayTimes, localDate } from "../../shared/time";
import type { eventRecurrenceDays, eventRecurrences } from "./schema";

const allowedParts = new Set([
	"FREQ",
	"INTERVAL",
	"BYDAY",
	"BYMONTHDAY",
	"BYMONTH",
	"BYSETPOS",
	"WKST",
	"COUNT",
]);
export function validateRule(rule: string, anchorDate: string) {
	const parts = rule.split(";");
	if (
		parts.some((part) => !allowedParts.has(part.split("=")[0])) ||
		new Set(parts.map((p) => p.split("=")[0])).size !== parts.length
	)
		throw new Error(
			"Use a date-based RRULE; supply the end separately as untilDate",
		);
	const options = RRule.parseString(rule);
	if (
		![RRule.DAILY, RRule.WEEKLY, RRule.MONTHLY, RRule.YEARLY].includes(
			options.freq as number,
		)
	)
		throw new Error(
			"Supported frequencies are DAILY, WEEKLY, MONTHLY, and YEARLY",
		);
	if (
		options.interval !== undefined &&
		(!Number.isInteger(options.interval) ||
			options.interval < 1 ||
			options.interval > 1000)
	)
		throw new Error("Invalid recurrence interval");
	if (
		options.count != null &&
		(options.count < 1 ||
			options.count > 100000 ||
			!Number.isInteger(options.count))
	)
		throw new Error("Invalid recurrence count");
	return new RRule({
		...options,
		dtstart: new Date(`${anchorDate}T00:00:00Z`),
	});
}
export type Recurrence = typeof eventRecurrences.$inferSelect;
export type TemplateDay = typeof eventRecurrenceDays.$inferSelect;
export function recurringDaysAt(
	recurrence: Recurrence,
	days: TemplateDay[],
	timezone: string,
	at: Date,
) {
	if (recurrence.mode !== "scheduled" || !recurrence.rrule || !days.length)
		return [];
	const today = localDate(at, timezone);
	const lookback = Math.max(...days.map((d) => d.dayOffset)) + 1;
	const rule = validateRule(recurrence.rrule, recurrence.anchorDate);
	const anchors = rule.between(
		new Date(`${addDays(today, -lookback)}T00:00:00Z`),
		new Date(`${today}T23:59:59Z`),
		true,
	);
	return anchors.flatMap((anchor) => {
		const originalAnchor = anchor.toISOString().slice(0, 10);
		if (recurrence.untilDate && originalAnchor > recurrence.untilDate)
			return [];
		return days.flatMap((day) => {
			const date = addDays(originalAnchor, day.dayOffset);
			try {
				const times = dayTimes(
					date,
					day.timeKind,
					day.startMinute,
					day.endMinute,
					timezone,
				);
				return containsTime(times.startsAt, times.endsAt, at)
					? [{ originalAnchor, date, description: day.description, ...times }]
					: [];
			} catch (error) {
				// A recurrence falling into a DST gap/fold is omitted rather than shifted.
				if (error instanceof RangeError) return [];
				throw error;
			}
		});
	});
}
