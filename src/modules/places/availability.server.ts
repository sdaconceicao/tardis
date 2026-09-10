import { Temporal } from "@js-temporal/polyfill";
import { and, inArray, lte, or, sql } from "drizzle-orm";
import type { Connection } from "../../db/client.server";
import { readable } from "../../shared/access";
import { DomainError } from "../../shared/errors";
import { pricesAt } from "../../shared/prices";
import {
	addDays,
	containsTime,
	localDate,
	minuteInstant,
} from "../../shared/time";
import type { AvailabilityQuery } from "../../shared/validation";
import type { Actor } from "../identity/contracts";
import {
	placeHoursExceptionIntervals,
	placeHoursExceptions,
	placeHoursIntervals,
	placeHoursSchedules,
	placeHoursWeekdays,
	placePrices,
	places,
} from "./schema";

type Interval = { startMinute: number; endMinute: number };
type HoursDay = { state: "open" | "closed" | "unknown"; intervals: Interval[] };
export function openingIntervalsAt(
	date: string,
	timezone: string,
	regular: (date: string) => HoursDay | undefined,
	exceptions: Map<string, HoursDay>,
) {
	const todayStart = minuteInstant(date, 0, timezone, "compatible"),
		tomorrowStart = minuteInstant(addDays(date, 1), 0, timezone, "compatible");
	const toIntervals = (day: string, hours: HoursDay | undefined) =>
		hours?.state === "open"
			? hours.intervals.map((i) => ({
					startsAt: minuteInstant(day, i.startMinute, timezone, "compatible"),
					endsAt: minuteInstant(day, i.endMinute, timezone, "compatible"),
				}))
			: [];
	const todayException = exceptions.get(date);
	if (todayException)
		return toIntervals(date, todayException).map((i) => ({
			...i,
			endsAt: new Date(Math.min(i.endsAt.getTime(), tomorrowStart.getTime())),
		}));
	const yesterday = addDays(date, -1);
	return [
		...toIntervals(date, regular(date)),
		...toIntervals(yesterday, exceptions.get(yesterday) ?? regular(yesterday)),
	]
		.map((i) => ({
			startsAt: new Date(Math.max(i.startsAt.getTime(), todayStart.getTime())),
			endsAt: new Date(Math.min(i.endsAt.getTime(), tomorrowStart.getTime())),
		}))
		.filter((i) => i.endsAt > i.startsAt);
}
export async function findAvailablePlaces(
	db: Connection,
	actor: Actor | null,
	q: AvailabilityQuery,
	locationIds: string[],
) {
	if (!locationIds.length) return [];
	const candidates = await db
		.select()
		.from(places)
		.where(
			and(
				inArray(places.locationId, locationIds),
				readable(places.ownerId, places.visibility, actor),
			),
		)
		.limit(501);
	if (candidates.length > 500)
		throw new DomainError(
			422,
			"Too many nearby places; narrow the search radius",
		);
	if (!candidates.length) return [];
	const ids = candidates.map((p) => p.id);
	const dates = candidates.map((p) => localDate(q.at, p.timezone)).sort();
	const low = addDays(dates[0], -1),
		high = dates[dates.length - 1];
	const schedules = await db
		.select()
		.from(placeHoursSchedules)
		.where(
			and(
				inArray(placeHoursSchedules.placeId, ids),
				lte(placeHoursSchedules.validFrom, high),
				or(
					sql`${placeHoursSchedules.validTo} IS NULL`,
					sql`${placeHoursSchedules.validTo} > ${low}`,
				),
			),
		);
	const weekdays = schedules.length
		? await db
				.select()
				.from(placeHoursWeekdays)
				.where(
					inArray(
						placeHoursWeekdays.scheduleId,
						schedules.map((s) => s.id),
					),
				)
		: [];
	const intervals = weekdays.length
		? await db
				.select()
				.from(placeHoursIntervals)
				.where(
					inArray(
						placeHoursIntervals.weekdayId,
						weekdays.map((d) => d.id),
					),
				)
		: [];
	const exceptions = await db
		.select()
		.from(placeHoursExceptions)
		.where(
			and(
				inArray(placeHoursExceptions.placeId, ids),
				sql`${placeHoursExceptions.date} BETWEEN ${low} AND ${high}`,
			),
		);
	const exceptionIntervals = exceptions.length
		? await db
				.select()
				.from(placeHoursExceptionIntervals)
				.where(
					inArray(
						placeHoursExceptionIntervals.exceptionId,
						exceptions.map((e) => e.id),
					),
				)
		: [];
	const prices = await db
		.select()
		.from(placePrices)
		.where(inArray(placePrices.placeId, ids));
	return candidates.flatMap((place) => {
		const regular = (date: string) => {
			const schedule = schedules.find(
				(s) =>
					s.placeId === place.id &&
					s.validFrom <= date &&
					(!s.validTo || date < s.validTo),
			);
			const day = weekdays.find(
				(d) =>
					d.scheduleId === schedule?.id &&
					d.weekday === Temporal.PlainDate.from(date).dayOfWeek,
			);
			return day
				? { ...day, intervals: intervals.filter((i) => i.weekdayId === day.id) }
				: undefined;
		};
		const overrides = new Map(
			exceptions
				.filter((e) => e.placeId === place.id)
				.map((e) => [
					e.date,
					{
						...e,
						intervals: exceptionIntervals.filter((i) => i.exceptionId === e.id),
					},
				]),
		);
		const matching = openingIntervalsAt(
			localDate(q.at, place.timezone),
			place.timezone,
			regular,
			overrides,
		).filter((i) => containsTime(i.startsAt, i.endsAt, q.at));
		return matching.length
			? [
					{
						kind: "place" as const,
						id: place.id,
						title: place.name,
						locationId: place.locationId,
						timezone: place.timezone,
						intervals: matching,
						prices: pricesAt(
							prices.filter((p) => p.placeId === place.id),
							q.at,
							place.timezone,
						),
					},
				]
			: [];
	});
}
