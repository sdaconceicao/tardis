import { describe, expect, it } from "vitest";
import {
	dayInputSchema,
	recurrenceInputSchema,
} from "../modules/events/contracts";
import { openingIntervalsAt } from "../modules/places/availability.server";
import { assertPriceWindows, occurrencePricesAt } from "./prices";
import { containsTime, dayTimes } from "./time";
import { priceSchema } from "./validation";

describe("availability time semantics", () => {
	it("includes opening, excludes closing, and searches overnight intervals", () => {
		const d = dayTimes("2026-09-18", "timed", 1320, 1560, "America/New_York");
		expect(
			containsTime(d.startsAt, d.endsAt, new Date("2026-09-19T02:00:00Z")),
		).toBe(true);
		expect(
			containsTime(d.startsAt, d.endsAt, new Date("2026-09-19T05:00:00Z")),
		).toBe(true);
		expect(
			containsTime(d.startsAt, d.endsAt, new Date("2026-09-19T06:00:00Z")),
		).toBe(false);
	});
	it("uses local midnight for 23-hour and 25-hour all-day events", () => {
		for (const [date, hours] of [
			["2026-03-08", 23],
			["2026-11-01", 25],
		] as const) {
			const d = dayTimes(date, "all_day", null, null, "America/New_York");
			expect((Number(d.endsAt) - Number(d.startsAt)) / 3600000).toBe(hours);
		}
	});
	it("rejects nonexistent and ambiguous manually entered local times", () => {
		expect(() =>
			dayTimes("2026-03-08", "timed", 150, 240, "America/New_York"),
		).toThrow();
		expect(() =>
			dayTimes("2026-11-01", "timed", 90, 180, "America/New_York"),
		).toThrow();
	});
	it("keeps unknown hours unavailable and rejects incomplete timed days", () => {
		expect(dayTimes("2026-09-18", "unknown", null, null, "UTC")).toEqual({
			startsAt: null,
			endsAt: null,
		});
		expect(
			dayInputSchema.safeParse({
				date: "2026-09-18",
				timeKind: "timed",
				startMinute: 540,
			}).success,
		).toBe(false);
	});
	it("lets a date closure suppress yesterday's overnight opening", () => {
		const regular = () => ({
			state: "open" as const,
			intervals: [{ startMinute: 1320, endMinute: 1560 }],
		});
		const intervals = openingIntervalsAt(
			"2026-09-19",
			"UTC",
			regular,
			new Map([["2026-09-19", { state: "closed", intervals: [] }]]),
		);
		expect(intervals).toEqual([]);
	});
	it("does not fill a lunch break in place hours", () => {
		const regular = () => ({
			state: "open" as const,
			intervals: [
				{ startMinute: 540, endMinute: 720 },
				{ startMinute: 780, endMinute: 1020 },
			],
		});
		const intervals = openingIntervalsAt(
			"2026-09-19",
			"UTC",
			regular,
			new Map(),
		);
		expect(
			intervals.some((i) =>
				containsTime(i.startsAt, i.endsAt, new Date("2026-09-19T12:30:00Z")),
			),
		).toBe(false);
	});
	it("rejects overlap but accepts adjacent price windows and free overrides", () => {
		const base = priceSchema.parse({
			amount: "15.00",
			currency: "USD",
			validFrom: "2026-01-01",
		});
		expect(() => assertPriceWindows([base, base])).toThrow();
		expect(() =>
			assertPriceWindows([
				{ ...base, endMinute: 900 },
				{ ...base, startMinute: 900 },
			]),
		).not.toThrow();
		const prices = occurrencePricesAt(
			[
				{ ...base, occurrenceId: null },
				{ ...base, amount: "0.00", occurrenceId: "edition" },
			],
			"edition",
			new Date("2026-09-18T14:00:00Z"),
			"UTC",
		);
		expect(prices.map((p) => p.amount)).toEqual(["0.00"]);
	});
	it("evaluates event default prices in the event zone even when the occurrence moves", () => {
		const base = priceSchema.parse({
			amount: "15.00",
			currency: "USD",
			validFrom: "2026-01-01",
			startMinute: 900,
		});
		expect(
			occurrencePricesAt(
				[{ ...base, occurrenceId: null }],
				"edition",
				new Date("2026-09-18T20:00:00Z"),
				"America/Los_Angeles",
				"America/New_York",
			),
		).toHaveLength(1);
	});
	it("accepts every-two-year rules and rejects unsupported sub-day expansion", () => {
		expect(
			recurrenceInputSchema.safeParse({
				mode: "scheduled",
				anchorDate: "2026-01-01",
				rrule: "FREQ=YEARLY;INTERVAL=2",
				days: [{ dayOffset: 0, timeKind: "all_day" }],
			}).success,
		).toBe(true);
		expect(
			recurrenceInputSchema.safeParse({
				mode: "scheduled",
				anchorDate: "2026-01-01",
				rrule: "FREQ=SECONDLY",
				days: [{ dayOffset: 0, timeKind: "all_day" }],
			}).success,
		).toBe(false);
	});
});
