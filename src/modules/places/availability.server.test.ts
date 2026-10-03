import { describe, expect, it, vi } from "vitest";
import { findAvailablePlaces, openingIntervalsAt } from "./availability.server";

const query = {
	at: new Date("2026-09-18T12:00:00Z"),
	latitude: 40,
	longitude: -73,
	radiusMeters: 25000,
	limit: 50,
	offset: 0,
};

function database(...results: unknown[][]) {
	const select = vi.fn(() => {
		const rows = results.shift() ?? [];
		const chain = {
			from: () => chain,
			where: () =>
				Object.assign(Promise.resolve(rows), { limit: async () => rows }),
		};
		return chain;
	});
	return { select };
}

describe("place availability", () => {
	it("does not query when no nearby locations exist", async () => {
		const db = database();
		await expect(
			findAvailablePlaces(db as never, null, query, []),
		).resolves.toEqual([]);
		expect(db.select).not.toHaveBeenCalled();
	});

	it("rejects too many nearby places before loading schedules", async () => {
		const db = database(Array.from({ length: 501 }, () => ({})));
		await expect(
			findAvailablePlaces(db as never, null, query, ["location"]),
		).rejects.toMatchObject({ status: 422 });
		expect(db.select).toHaveBeenCalledTimes(1);
	});

	it("returns early when no candidate place matches", async () => {
		const db = database([]);
		await expect(
			findAvailablePlaces(db as never, null, query, ["location"]),
		).resolves.toEqual([]);
		expect(db.select).toHaveBeenCalledTimes(1);
	});

	it("returns an open place with the interval containing the requested instant", async () => {
		const db = database(
			[
				{
					id: "place",
					name: "Museum",
					locationId: "location",
					timezone: "UTC",
				},
			],
			[
				{
					id: "season",
					placeId: "place",
					validFrom: "2026-01-01",
					validTo: null,
				},
			],
			[{ id: "friday", scheduleId: "season", weekday: 5, state: "open" }],
			[{ weekdayId: "friday", startMinute: 540, endMinute: 1020 }],
			[],
			[],
		);
		const result = await findAvailablePlaces(db as never, null, query, [
			"location",
		]);
		expect(result).toEqual([
			expect.objectContaining({
				kind: "place",
				id: "place",
				title: "Museum",
				prices: [],
				intervals: [
					{
						startsAt: new Date("2026-09-18T09:00:00Z"),
						endsAt: new Date("2026-09-18T17:00:00Z"),
					},
				],
			}),
		]);
	});

	it("carries yesterday's overnight hours into today", () => {
		const regular = (date: string) =>
			date === "2026-09-17"
				? {
						state: "open" as const,
						intervals: [{ startMinute: 1380, endMinute: 1560 }],
					}
				: undefined;
		const result = openingIntervalsAt("2026-09-18", "UTC", regular, new Map());
		expect(result).toEqual([
			{
				startsAt: new Date("2026-09-18T00:00:00Z"),
				endsAt: new Date("2026-09-18T02:00:00Z"),
			},
		]);
	});

	it("lets today's exception replace both regular and overnight hours", () => {
		const regular = () => ({
			state: "open" as const,
			intervals: [{ startMinute: 0, endMinute: 1440 }],
		});
		const result = openingIntervalsAt(
			"2026-09-18",
			"UTC",
			regular,
			new Map([["2026-09-18", { state: "closed", intervals: [] }]]),
		);
		expect(result).toEqual([]);
	});

	it("uses an open exception when the regular schedule is closed", async () => {
		const db = database(
			[
				{
					id: "place",
					name: "Museum",
					locationId: "location",
					timezone: "UTC",
				},
			],
			[],
			[{ id: "special", placeId: "place", date: "2026-09-18", state: "open" }],
			[{ exceptionId: "special", startMinute: 600, endMinute: 780 }],
			[],
		);
		const result = await findAvailablePlaces(db as never, null, query, [
			"location",
		]);
		expect(result).toEqual([
			expect.objectContaining({
				id: "place",
				intervals: [
					{
						startsAt: new Date("2026-09-18T10:00:00Z"),
						endsAt: new Date("2026-09-18T13:00:00Z"),
					},
				],
			}),
		]);
	});
});
