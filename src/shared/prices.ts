import type { z } from "zod";
import { conflict } from "./errors";
import { localClock } from "./time";
import type { priceSchema } from "./validation";
export type Price = z.infer<typeof priceSchema>;
export function assertPriceWindows(prices: Price[]) {
	for (let i = 0; i < prices.length; i++)
		for (let j = i + 1; j < prices.length; j++) {
			const a = prices[i],
				b = prices[j];
			if (
				a.category === b.category &&
				a.label === b.label &&
				a.coverage === b.coverage &&
				a.validFrom < (b.validTo ?? "9999-12-31") &&
				b.validFrom < (a.validTo ?? "9999-12-31") &&
				a.weekdays.some((d) => b.weekdays.includes(d)) &&
				a.startMinute < b.endMinute &&
				b.startMinute < a.endMinute
			)
				throw conflict(
					"Prices for the same label, category, and coverage must not overlap",
				);
		}
}
export function pricesAt<T extends Price>(
	prices: T[],
	at: Date,
	timezone: string,
): T[] {
	const { date, weekday, minute } = localClock(at, timezone);
	return prices.filter(
		(p) =>
			p.validFrom <= date &&
			(!p.validTo || date < p.validTo) &&
			p.weekdays.includes(weekday) &&
			p.startMinute <= minute &&
			minute < p.endMinute,
	);
}
export function occurrencePricesAt<
	T extends Price & { occurrenceId: string | null },
>(
	prices: T[],
	occurrenceId: string | null,
	at: Date,
	timezone: string,
	eventTimezone = timezone,
) {
	const matching = [
		...pricesAt(
			prices.filter((p) => p.occurrenceId === null),
			at,
			eventTimezone,
		),
		...pricesAt(
			prices.filter(
				(p) => p.occurrenceId !== null && p.occurrenceId === occurrenceId,
			),
			at,
			timezone,
		),
	];
	const key = (p: T) => JSON.stringify([p.label, p.category, p.coverage]);
	const overridden = new Set(
		matching.filter((p) => p.occurrenceId !== null).map(key),
	);
	return matching.filter(
		(p) => p.occurrenceId !== null || !overridden.has(key(p)),
	);
}
