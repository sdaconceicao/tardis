import { describe, expect, it } from "vitest";
import { exceptionSchema, placeInputSchema, scheduleSchema } from "./contracts";

const open = {
	weekday: 5,
	state: "open",
	intervals: [{ startMinute: 540, endMinute: 720 }],
};

describe("place inputs", () => {
	it("requires a valid place and applies defaults", () => {
		const place = {
			name: " Museum ",
			timezone: "UTC",
			location: { label: "Main", latitude: 0, longitude: 0 },
		};
		expect(placeInputSchema.parse(place)).toMatchObject({
			name: "Museum",
			visibility: "private",
			tagIds: [],
			prices: [],
		});
		expect(
			placeInputSchema.safeParse({ ...place, ownerId: "other" }).success,
		).toBe(false);
	});

	it("accepts adjacent intervals and rejects overlapping or duplicate weekdays", () => {
		const schedule = {
			validFrom: "2026-01-01",
			weekdays: [
				{
					...open,
					intervals: [...open.intervals, { startMinute: 720, endMinute: 900 }],
				},
			],
		};
		expect(scheduleSchema.safeParse(schedule).success).toBe(true);
		expect(
			scheduleSchema.safeParse({ ...schedule, validTo: "2026-01-01" }).success,
		).toBe(false);
		expect(
			scheduleSchema.safeParse({ ...schedule, weekdays: [open, open] }).success,
		).toBe(false);
		expect(
			scheduleSchema.safeParse({
				...schedule,
				weekdays: [
					{
						...open,
						intervals: [
							...open.intervals,
							{ startMinute: 700, endMinute: 900 },
						],
					},
				],
			}).success,
		).toBe(false);
	});

	it("requires intervals only when an exception opens the place", () => {
		expect(
			exceptionSchema.safeParse({
				date: "2026-09-18",
				state: "open",
				intervals: open.intervals,
			}).success,
		).toBe(true);
		expect(
			exceptionSchema.safeParse({ date: "2026-09-18", state: "open" }).success,
		).toBe(false);
		expect(
			exceptionSchema.safeParse({
				date: "2026-09-18",
				state: "closed",
				intervals: open.intervals,
			}).success,
		).toBe(false);
		expect(
			exceptionSchema.safeParse({ date: "2026-09-18", state: "unknown" })
				.success,
		).toBe(true);
	});

	it("rejects an open weekday without intervals and out-of-range weekdays", () => {
		const schedule = {
			validFrom: "2026-01-01",
			weekdays: [{ weekday: 8, state: "open", intervals: open.intervals }],
		};
		expect(scheduleSchema.safeParse(schedule).success).toBe(false);
		expect(
			scheduleSchema.safeParse({
				...schedule,
				weekdays: [{ weekday: 5, state: "open" }],
			}).success,
		).toBe(false);
		expect(
			scheduleSchema.safeParse({
				...schedule,
				weekdays: [{ weekday: 5, state: "closed", intervals: [] }],
			}).success,
		).toBe(true);
	});
});
