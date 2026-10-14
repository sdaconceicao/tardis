import { describe, expect, it } from "vitest";
import {
	buildEventCreation,
	type Draft,
	emptyEventLocation,
	firstEventDate,
	selectedWeekdays,
} from "./CreateEventPage.utils";

const draft = (): Draft => ({
	title: "Autumn Craft Fair",
	description: "Workshops and a market",
	visibility: "public",
	location: {
		...emptyEventLocation(),
		name: "Town square",
		poi: {
			id: "11111111-1111-4111-8111-111111111111",
			name: "Town square",
			address: "Main Street",
			latitude: 40,
			longitude: -75,
			timezone: "America/New_York",
		},
	},
	days: [
		{
			id: "friday",
			date: "2026-09-18",
			description: "Workshops",
			timeKind: "timed",
			startsAt: "09:00",
			endsAt: "17:00",
			endsNextDay: false,
		},
		{
			id: "saturday",
			date: "2026-09-19",
			description: "",
			timeKind: "all_day",
			startsAt: "",
			endsAt: "",
			endsNextDay: false,
		},
	],
	recurrence: "once",
	frequency: "YEARLY",
	weekdays: [],
	interval: 1,
	untilDate: "",
	expectedMonths: 12,
});

describe("event creation payload", () => {
	it("uses the earliest day when defaulting a weekly schedule", () => {
		const input = draft();
		input.days.reverse();
		expect(firstEventDate(input.days)).toBe("2026-09-18");
		expect(selectedWeekdays(input)).toEqual(["FR"]);
		input.weekdays = ["MO", "FR"];
		expect(selectedWeekdays(input)).toEqual(["MO", "FR"]);
	});

	it("links the selected POI and saves one multi-day occurrence", () => {
		const result = buildEventCreation(draft());
		expect(result.event).toMatchObject({
			placeId: draft().location.poi?.id,
			visibility: "public",
			timezone: "America/New_York",
		});
		expect(result.occurrence.days).toMatchObject([
			{ date: "2026-09-18", startMinute: 540, endMinute: 1020 },
			{ date: "2026-09-19", timeKind: "all_day" },
		]);
		expect(result.recurrence).toBeNull();
	});

	it("builds a two-year rule with day offsets", () => {
		const input = draft();
		input.recurrence = "scheduled";
		input.interval = 2;
		input.untilDate = "2030-09-18";
		expect(buildEventCreation(input).recurrence).toMatchObject({
			mode: "scheduled",
			anchorDate: "2026-09-18",
			untilDate: "2030-09-18",
			rrule: "FREQ=YEARLY;INTERVAL=2",
			days: [{ dayOffset: 0 }, { dayOffset: 1 }],
		});
	});

	it("creates an expected rule without copying exact hours", () => {
		const input = draft();
		input.recurrence = "expected";
		input.expectedMonths = 24;
		expect(buildEventCreation(input).recurrence).toMatchObject({
			mode: "expected",
			intervalMonths: 24,
			days: [],
		});
	});

	it("allows selected weekly weekdays for a single-day edition", () => {
		const input = draft();
		input.days = [input.days[0]];
		input.recurrence = "scheduled";
		input.frequency = "WEEKLY";
		input.weekdays = ["FR", "MO"];
		expect(buildEventCreation(input).recurrence?.rrule).toBe(
			"FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,FR",
		);
	});

	it("saves an overnight end minute on the following day", () => {
		const input = draft();
		input.days = [
			{
				...input.days[0],
				startsAt: "22:00",
				endsAt: "02:00",
				endsNextDay: true,
			},
		];
		expect(buildEventCreation(input).occurrence.days[0]).toMatchObject({
			startMinute: 1320,
			endMinute: 1560,
		});
	});

	it("rejects missing venues, overlapping daily templates, and invalid times", () => {
		const input = draft();
		input.location.poi = null;
		expect(() => buildEventCreation(input)).toThrow("Choose a place");
		input.location.poi = draft().location.poi;
		input.recurrence = "scheduled";
		input.frequency = "DAILY";
		expect(() => buildEventCreation(input)).toThrow("overlap");
		input.recurrence = "once";
		input.days[0].endsAt = "08:00";
		expect(() => buildEventCreation(input)).toThrow("end time");
	});

	it("saves a confirmed manual address as a standalone location", () => {
		const input = draft();
		input.location = {
			name: "Community hall",
			address: {
				line1: "12 Main Street",
				line2: "Floor 2",
				city: "Philadelphia",
				region: "Pennsylvania",
				postalCode: "19106",
				country: "United States",
			},
			poi: null,
			match: {
				id: "address:1",
				label: "12 Main Street, Philadelphia",
				address: {
					line1: "12 Main Street",
					line2: "",
					city: "Philadelphia",
					region: "Pennsylvania",
					postalCode: "19106",
					country: "United States",
				},
				latitude: 39.95,
				longitude: -75.15,
				timezone: "America/New_York",
				source: "address",
			},
		};
		expect(buildEventCreation(input).event).toMatchObject({
			timezone: "America/New_York",
			location: {
				label: "Community hall",
				address:
					"12 Main Street, Floor 2, Philadelphia, Pennsylvania, 19106, United States",
				latitude: 39.95,
				longitude: -75.15,
			},
		});
	});
});
