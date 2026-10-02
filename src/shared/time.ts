import { Temporal } from "@js-temporal/polyfill";

export function localDate(at: Date, timezone: string) {
	return Temporal.Instant.from(at.toISOString())
		.toZonedDateTimeISO(timezone)
		.toPlainDate()
		.toString();
}
export function addDays(date: string, days: number) {
	return Temporal.PlainDate.from(date).add({ days }).toString();
}
export function minuteInstant(
	date: string,
	minute: number,
	timezone: string,
	disambiguation: "reject" | "compatible" = "reject",
) {
	const time = Temporal.PlainDate.from(date)
		.toPlainDateTime()
		.add({ minutes: minute });
	return new Date(
		time.toZonedDateTime(timezone, { disambiguation }).epochMilliseconds,
	);
}
export function dayTimes(
	date: string,
	kind: "timed" | "all_day" | "unknown",
	start: number | null | undefined,
	end: number | null | undefined,
	timezone: string,
) {
	if (kind === "unknown") return { startsAt: null, endsAt: null };
	if (kind === "all_day")
		return {
			startsAt: minuteInstant(date, 0, timezone, "compatible"),
			endsAt: minuteInstant(date, 1440, timezone, "compatible"),
		};
	if (start == null || end == null)
		throw new RangeError("Timed days require start and end times");
	return {
		startsAt: minuteInstant(date, start, timezone),
		endsAt: minuteInstant(date, end, timezone),
	};
}
export function containsTime(start: Date | null, end: Date | null, at: Date) {
	return start !== null && end !== null && start <= at && at < end;
}
export function localClock(at: Date, timezone: string) {
	const local = Temporal.Instant.from(at.toISOString()).toZonedDateTimeISO(
		timezone,
	);
	return {
		date: local.toPlainDate().toString(),
		weekday: local.dayOfWeek,
		minute: local.hour * 60 + local.minute,
	};
}
