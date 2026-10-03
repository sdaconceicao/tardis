import { describe, expect, it } from "vitest";
import type { Recurrence, TemplateDay } from "./recurrence";
import { recurringDaysAt, validateRule } from "./recurrence";

const recurrence = {
	id: "series",
	mode: "scheduled",
	anchorDate: "2026-09-18",
	rrule: "FREQ=DAILY",
	untilDate: null,
} as Recurrence;
const day = {
	dayOffset: 0,
	timeKind: "timed",
	startMinute: 600,
	endMinute: 660,
	description: "Morning",
	recurrenceId: "series",
} as TemplateDay;

describe("recurrence rules", () => {
	it("accepts bounded date rules and rejects time parts, duplicate parts, and invalid limits", () => {
		expect(
			validateRule("FREQ=YEARLY;INTERVAL=2;COUNT=10", "2026-01-01").options
				.interval,
		).toBe(2);
		for (const rule of [
			"FREQ=HOURLY",
			"FREQ=DAILY;BYHOUR=10",
			"FREQ=DAILY;FREQ=WEEKLY",
			"FREQ=DAILY;INTERVAL=0",
			"FREQ=DAILY;INTERVAL=1001",
			"FREQ=DAILY;COUNT=0",
			"FREQ=DAILY;COUNT=100001",
		])
			expect(() => validateRule(rule, "2026-01-01")).toThrow();
	});

	it("finds active template days, including offsets from an earlier anchor", () => {
		const at = new Date("2026-09-19T10:30:00Z");
		const results = recurringDaysAt(
			recurrence,
			[{ ...day, dayOffset: 1 }],
			"UTC",
			at,
		);
		expect(results).toEqual([
			expect.objectContaining({
				originalAnchor: "2026-09-18",
				date: "2026-09-19",
				description: "Morning",
			}),
		]);
	});

	it("excludes ended, unscheduled, inactive, and missing-template recurrences", () => {
		const at = new Date("2026-09-19T10:30:00Z");
		expect(
			recurringDaysAt(
				{ ...recurrence, untilDate: "2026-09-18" },
				[day],
				"UTC",
				at,
			),
		).toEqual([]);
		expect(
			recurringDaysAt({ ...recurrence, mode: "expected" }, [day], "UTC", at),
		).toEqual([]);
		expect(recurringDaysAt(recurrence, [], "UTC", at)).toEqual([]);
		expect(
			recurringDaysAt(
				recurrence,
				[day],
				"UTC",
				new Date("2026-09-19T11:00:00Z"),
			),
		).toEqual([]);
	});

	it("omits a template day in a daylight-saving gap", () => {
		const spring = { ...recurrence, anchorDate: "2026-03-08" };
		const gap = { ...day, startMinute: 150, endMinute: 180 };
		expect(
			recurringDaysAt(
				spring,
				[gap],
				"America/New_York",
				new Date("2026-03-08T07:30:00Z"),
			),
		).toEqual([]);
	});

	it("stops expanding after COUNT and includes the end anchor", () => {
		const oneDay = { ...recurrence, rrule: "FREQ=DAILY;COUNT=1" };
		expect(
			recurringDaysAt(oneDay, [day], "UTC", new Date("2026-09-18T10:30:00Z")),
		).toHaveLength(1);
		expect(
			recurringDaysAt(oneDay, [day], "UTC", new Date("2026-09-19T10:30:00Z")),
		).toEqual([]);
		expect(
			recurringDaysAt(
				{ ...recurrence, untilDate: "2026-09-19" },
				[day],
				"UTC",
				new Date("2026-09-19T10:30:00Z"),
			),
		).toHaveLength(1);
	});

	it("uses the event's local date for a recurrence near UTC midnight", () => {
		const west = { ...recurrence, anchorDate: "2026-09-18" };
		const evening = { ...day, startMinute: 1320, endMinute: 1380 };
		const results = recurringDaysAt(
			west,
			[evening],
			"America/Los_Angeles",
			new Date("2026-09-19T05:30:00Z"),
		);
		expect(results).toEqual([
			expect.objectContaining({
				originalAnchor: "2026-09-18",
				date: "2026-09-18",
			}),
		]);
	});
});
