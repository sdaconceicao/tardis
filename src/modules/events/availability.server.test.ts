import { describe, expect, it, vi } from "vitest";
import { findAvailableEvents } from "./availability.server";

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
			innerJoin: () => chain,
			where: () =>
				Object.assign(Promise.resolve(rows), { limit: async () => rows }),
		};
		return chain;
	});
	return { select };
}

describe("event availability", () => {
	it("does not query when no nearby locations exist", async () => {
		const db = database();
		await expect(
			findAvailableEvents(db as never, null, query, []),
		).resolves.toEqual([]);
		expect(db.select).not.toHaveBeenCalled();
	});

	it("rejects an unbounded nearby event set", async () => {
		const db = database(
			Array.from({ length: 2001 }, () => ({})),
			[],
		);
		await expect(
			findAvailableEvents(db as never, null, query, ["location"]),
		).rejects.toMatchObject({ status: 422 });
	});

	it("returns an empty result when neither stored nor recurring events match", async () => {
		const db = database([], []);
		await expect(
			findAvailableEvents(db as never, null, query, ["location"]),
		).resolves.toEqual([]);
		expect(db.select).toHaveBeenCalledTimes(2);
	});

	it("returns a stored event only while its timed day is active", async () => {
		const event = {
			id: "event",
			title: "Market",
			description: "Outdoor",
			timezone: "UTC",
		};
		const occurrence = {
			id: "occurrence",
			title: null,
			description: null,
			locationId: "location",
			timezone: "UTC",
		};
		const day = {
			date: "2026-09-18",
			description: null,
			startsAt: new Date("2026-09-18T09:00:00Z"),
			endsAt: new Date("2026-09-18T15:00:00Z"),
		};
		const db = database([{ event, occurrence, day }], [], []);
		const result = await findAvailableEvents(db as never, null, query, [
			"location",
		]);
		expect(result).toEqual([
			expect.objectContaining({
				id: "occurrence",
				eventId: "event",
				title: "Market",
				description: "Outdoor",
				prices: [],
			}),
		]);
	});

	it("expands an active recurrence when no stored override exists", async () => {
		const event = {
			id: "event",
			title: "Market",
			description: "Outdoor",
			timezone: "UTC",
			locationId: "location",
		};
		const recurrence = {
			id: "series",
			mode: "scheduled",
			rrule: "FREQ=DAILY",
			anchorDate: "2026-09-18",
			untilDate: null,
		};
		const template = {
			recurrenceId: "series",
			dayOffset: 0,
			timeKind: "all_day",
			startMinute: null,
			endMinute: null,
			description: "Today's fair",
		};
		const db = database([], [{ event, recurrence }], [template], [], []);
		const result = await findAvailableEvents(db as never, null, query, [
			"location",
		]);
		expect(result).toEqual([
			expect.objectContaining({
				id: "series:2026-09-18",
				date: "2026-09-18",
				description: "Today's fair",
			}),
		]);
	});

	it("suppresses a recurrence anchor when a stored override exists", async () => {
		const event = {
			id: "event",
			title: "Market",
			timezone: "UTC",
			locationId: "location",
		};
		const recurrence = {
			id: "series",
			mode: "scheduled",
			rrule: "FREQ=DAILY",
			anchorDate: "2026-09-18",
			untilDate: null,
		};
		const template = {
			recurrenceId: "series",
			dayOffset: 0,
			timeKind: "all_day",
			startMinute: null,
			endMinute: null,
		};
		const override = {
			recurrenceId: "series",
			originalAnchor: "2026-09-18",
		};
		const db = database(
			[],
			[{ event, recurrence }],
			[template],
			[override],
			[],
		);
		await expect(
			findAvailableEvents(db as never, null, query, ["location"]),
		).resolves.toEqual([]);
	});
});
