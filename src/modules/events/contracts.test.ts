import { describe, expect, it } from "vitest";
import {
	dayInputSchema,
	eventInputSchema,
	occurrenceInputSchema,
	recurrenceDaySchema,
	recurrenceInputSchema,
} from "./contracts";

const placeId = "550e8400-e29b-41d4-a716-446655440000";
const event = { title: " Market ", timezone: "UTC", placeId };
const day = { date: "2026-09-18", timeKind: "all_day" };

describe("event inputs", () => {
	it("requires coherent timed days and bounded recurrence offsets", () => {
		expect(
			dayInputSchema.safeParse({
				date: "2026-09-18",
				timeKind: "timed",
				startMinute: 540,
				endMinute: 600,
			}).success,
		).toBe(true);
		expect(
			dayInputSchema.safeParse({
				date: "2026-09-18",
				timeKind: "timed",
				startMinute: 540,
			}).success,
		).toBe(false);
		expect(
			dayInputSchema.safeParse({
				date: "2026-09-18",
				timeKind: "unknown",
				startMinute: 540,
				endMinute: 600,
			}).success,
		).toBe(false);
		expect(
			recurrenceDaySchema.safeParse({ dayOffset: 365, timeKind: "all_day" })
				.success,
		).toBe(true);
		expect(
			recurrenceDaySchema.safeParse({ dayOffset: 366, timeKind: "all_day" })
				.success,
		).toBe(false);
	});
	it("requires one location source and strips title whitespace", () => {
		expect(eventInputSchema.parse(event)).toMatchObject({
			title: "Market",
			visibility: "private",
			tagIds: [],
			prices: [],
		});
		const location = { label: "Hall", latitude: 0, longitude: 0 };
		expect(
			eventInputSchema.safeParse({ ...event, placeId: undefined, location })
				.success,
		).toBe(true);
		expect(eventInputSchema.safeParse({ ...event, location }).success).toBe(
			false,
		);
		expect(
			eventInputSchema.safeParse({ title: "Market", timezone: "UTC" }).success,
		).toBe(false);
	});

	it("requires a scheduled rule with distinct days or an expected month interval", () => {
		const scheduled = {
			mode: "scheduled",
			anchorDate: "2026-09-18",
			rrule: "FREQ=DAILY",
			days: [{ dayOffset: 0, timeKind: "all_day" }],
		};
		expect(recurrenceInputSchema.safeParse(scheduled).success).toBe(true);
		expect(
			recurrenceInputSchema.safeParse({
				...scheduled,
				days: [...scheduled.days, ...scheduled.days],
			}).success,
		).toBe(false);
		expect(
			recurrenceInputSchema.safeParse({ ...scheduled, untilDate: "2026-09-17" })
				.success,
		).toBe(false);
		expect(
			recurrenceInputSchema.safeParse({
				mode: "expected",
				anchorDate: "2026-09-01",
				intervalMonths: 2,
			}).success,
		).toBe(true);
		expect(
			recurrenceInputSchema.safeParse({
				mode: "expected",
				anchorDate: "2026-09-01",
				intervalMonths: 2,
				days: scheduled.days,
			}).success,
		).toBe(false);
	});

	it("requires paired override fields, exact days, and valid month placeholders", () => {
		const exact = { datePrecision: "exact", days: [day] };
		expect(occurrenceInputSchema.safeParse(exact).success).toBe(true);
		expect(
			occurrenceInputSchema.safeParse({ ...exact, days: [day, day] }).success,
		).toBe(false);
		expect(
			occurrenceInputSchema.safeParse({ ...exact, recurrenceId: placeId })
				.success,
		).toBe(false);
		expect(
			occurrenceInputSchema.safeParse({
				...exact,
				recurrenceId: placeId,
				originalAnchor: "2026-09-18",
			}).success,
		).toBe(true);
		expect(
			occurrenceInputSchema.safeParse({
				datePrecision: "month",
				status: "tentative",
				expectedMonth: "2026-09-01",
			}).success,
		).toBe(true);
		expect(
			occurrenceInputSchema.safeParse({
				datePrecision: "month",
				status: "scheduled",
				expectedMonth: "2026-09-01",
			}).success,
		).toBe(false);
		expect(
			occurrenceInputSchema.safeParse({
				datePrecision: "month",
				status: "tentative",
				expectedMonth: "2026-09-02",
			}).success,
		).toBe(false);
	});

	it("rejects incompatible venue changes and unknown ownership fields", () => {
		const exact = { datePrecision: "exact", days: [day] };
		const location = { label: "Hall", latitude: 0, longitude: 0 };
		expect(
			occurrenceInputSchema.safeParse({ ...exact, placeId, location }).success,
		).toBe(false);
		expect(
			occurrenceInputSchema.safeParse({ ...exact, ownerId: "other" }).success,
		).toBe(false);
	});
});
