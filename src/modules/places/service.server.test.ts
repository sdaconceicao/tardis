import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import { tags } from "../taxonomy/schema";
import { placeInputSchema } from "./contracts";
import {
	locations,
	placeHoursExceptionIntervals,
	placeHoursExceptions,
	placeHoursIntervals,
	placeHoursSchedules,
	placeHoursWeekdays,
	placePrices,
	places,
} from "./schema";
import {
	deleteException,
	deletePlace,
	getPlace,
	getPlaceHours,
	listPlaces,
	ownPlace,
	replaceSchedules,
	resolvePlaceVenue,
	saveException,
	savePlace,
} from "./service.server";

const actor = { subject: "owner" };
const dialect = new PgDialect();

function capturedSelect(rows: unknown[] = []) {
	const conditions: unknown[] = [];
	const locks: string[] = [];
	const paging: number[] = [];
	const select = vi.fn(() => ({
		from: () => ({
			where: (condition: unknown) => {
				conditions.push(condition);
				return Object.assign(Promise.resolve(rows), {
					for: (lock: string) => {
						locks.push(lock);
						return Promise.resolve(rows);
					},
					orderBy: () => ({
						limit: (limit: number) => ({
							offset: (offset: number) => {
								paging.push(limit, offset);
								return Promise.resolve(rows);
							},
						}),
					}),
				});
			},
		}),
	}));
	return { select, conditions, locks, paging };
}

function selectRows(...results: unknown[][]) {
	return {
		select: vi.fn(() => ({
			from: () => ({
				where: () => {
					const rows = results.shift() ?? [];
					return Object.assign(Promise.resolve(rows), {
						for: () => Promise.resolve(rows),
					});
				},
			}),
		})),
	};
}

describe("place service boundaries", () => {
	it("checks both place ID and owner under an update lock", async () => {
		const place = { id: "place", ownerId: "owner" };
		const db = capturedSelect([place]);
		await expect(ownPlace(db as never, actor, "place")).resolves.toEqual(place);
		const query = dialect.sqlToQuery(db.conditions[0] as never);
		expect(query.sql).toContain('"places"."id"');
		expect(query.sql).toContain('"places"."owner_id"');
		expect(query.params).toEqual(["place", "owner"]);
		expect(db.locks).toEqual(["update"]);
	});

	it("uses a share lock and visibility filter when resolving a venue", async () => {
		const db = capturedSelect([
			{
				id: "place",
				locationId: "location",
				timezone: "UTC",
				visibility: "public",
			},
		]);
		await expect(
			resolvePlaceVenue(db as never, actor, "place", "public"),
		).resolves.toEqual({
			placeId: "place",
			locationId: "location",
			timezone: "UTC",
		});
		const query = dialect.sqlToQuery(db.conditions[0] as never);
		expect(query.sql).toContain('"places"."visibility"');
		expect(query.params).toContain("place");
		expect(query.params).toContain("owner");
		expect(db.locks).toEqual(["share"]);
	});

	it("paginates only readable places", async () => {
		const db = capturedSelect([{ id: "place" }]);
		await expect(
			listPlaces(db as never, actor, { limit: 5, offset: 10 }),
		).resolves.toEqual([{ id: "place" }]);
		const query = dialect.sqlToQuery(db.conditions[0] as never);
		expect(query.sql).toContain('"places"."visibility"');
		expect(query.sql).toContain('"places"."owner_id"');
		expect(db.paging).toEqual([5, 10]);
	});

	it("hides a missing or unreadable place", async () => {
		const db = capturedSelect();
		await expect(getPlace(db as never, null, "secret")).rejects.toMatchObject({
			status: 404,
		});
		const query = dialect.sqlToQuery(db.conditions[0] as never);
		expect(query.sql).toContain('"places"."visibility"');
		expect(query.params).toContain("secret");
	});

	it("assembles a readable place with location, tags, prices, and hours", async () => {
		const rows = new Map<unknown, unknown[]>([
			[places, [{ id: "place", locationId: "location", visibility: "public" }]],
			[locations, [{ id: "location", label: "Park" }]],
			[tags, [{ id: "tag", slug: "music" }]],
			[placePrices, [{ id: "price", placeId: "place" }]],
			[placeHoursSchedules, [{ id: "season", placeId: "place" }]],
			[
				placeHoursWeekdays,
				[{ id: "friday", scheduleId: "season", weekday: 5 }],
			],
			[
				placeHoursIntervals,
				[{ weekdayId: "friday", startMinute: 540, endMinute: 720 }],
			],
		]);
		const db = {
			select: vi.fn(() => ({
				from: (table: unknown) => ({
					where: () => Promise.resolve(rows.get(table) ?? []),
					innerJoin: () => Promise.resolve(rows.get(table) ?? []),
				}),
			})),
		};
		await expect(getPlace(db as never, null, "place")).resolves.toMatchObject({
			id: "place",
			location: { label: "Park" },
			tags: [{ slug: "music" }],
			prices: [{ id: "price" }],
			schedules: [
				{
					id: "season",
					weekdays: [{ weekday: 5, intervals: [{ startMinute: 540 }] }],
				},
			],
			exceptions: [],
		});
	});

	it("deletes an owned place after locking it", async () => {
		const base = capturedSelect([{ id: "place", ownerId: "owner" }]);
		const where = vi.fn().mockResolvedValue(undefined);
		const deleteRows = vi.fn(() => ({ where }));
		const db = {
			transaction: vi.fn((run) =>
				run({ select: base.select, delete: deleteRows }),
			),
		};
		await deletePlace(db as never, actor, "place");
		expect(base.locks).toEqual(["update"]);
		expect(deleteRows).toHaveBeenCalledWith(places);
		expect(dialect.sqlToQuery(where.mock.calls[0][0]).params).toEqual([
			"place",
		]);
	});

	it("deletes only the dated exception for the owned place", async () => {
		const base = capturedSelect([{ id: "place", ownerId: "owner" }]);
		const where = vi.fn().mockResolvedValue(undefined);
		const deleteRows = vi.fn(() => ({ where }));
		const db = {
			transaction: vi.fn((run) =>
				run({ select: base.select, delete: deleteRows }),
			),
		};
		await deleteException(db as never, actor, "place", "2026-12-25");
		expect(deleteRows).toHaveBeenCalledWith(placeHoursExceptions);
		expect(dialect.sqlToQuery(where.mock.calls[0][0]).params).toEqual([
			"place",
			"2026-12-25",
		]);
	});
	it("does not expose a missing place", async () => {
		await expect(
			resolvePlaceVenue(selectRows([]) as never, actor, "missing", "private"),
		).rejects.toMatchObject({ status: 404 });
	});

	it("rejects ownership checks for a missing place", async () => {
		await expect(
			ownPlace(selectRows([]) as never, actor, "missing"),
		).rejects.toMatchObject({ status: 404 });
	});

	it("does not attach a public event to a private place", async () => {
		const db = selectRows([
			{
				id: "place",
				locationId: "location",
				visibility: "private",
				timezone: "UTC",
			},
		]);
		await expect(
			resolvePlaceVenue(db as never, actor, "place", "public"),
		).rejects.toMatchObject({ status: 409 });
		const allowed = selectRows([
			{
				id: "place",
				locationId: "location",
				visibility: "private",
				timezone: "UTC",
			},
		]);
		await expect(
			resolvePlaceVenue(allowed as never, actor, "place", "private"),
		).resolves.toEqual({
			placeId: "place",
			locationId: "location",
			timezone: "UTC",
		});
	});

	it("rejects overlapping seasons before touching the database", async () => {
		const transaction = vi.fn();
		await expect(
			replaceSchedules({ transaction } as never, actor, "place", [
				{ validFrom: "2026-01-01", validTo: "2026-07-01", weekdays: [] },
				{ validFrom: "2026-06-01", validTo: null, weekdays: [] },
			]),
		).rejects.toMatchObject({ status: 409 });
		expect(transaction).not.toHaveBeenCalled();
	});

	it("groups stored intervals under their weekday and exception", async () => {
		const db = selectRows(
			[{ id: "season", placeId: "place" }],
			[{ id: "friday", scheduleId: "season", weekday: 5 }],
			[{ weekdayId: "friday", startMinute: 540, endMinute: 720 }],
			[{ id: "holiday", placeId: "place", date: "2026-12-25" }],
			[{ exceptionId: "holiday", startMinute: 600, endMinute: 660 }],
		);
		const hours = await getPlaceHours(db as never, "place");
		expect(hours.schedules[0].weekdays[0].intervals).toEqual([
			{ weekdayId: "friday", startMinute: 540, endMinute: 720 },
		]);
		expect(hours.exceptions[0].intervals).toEqual([
			{ exceptionId: "holiday", startMinute: 600, endMinute: 660 },
		]);
	});

	it("clears schedules and returns empty hours when a replacement is empty", async () => {
		const base = selectRows([{ id: "place", ownerId: "owner" }], [], []);
		const where = vi.fn().mockResolvedValue(undefined);
		const deleteRows = vi.fn(() => ({ where }));
		const db = {
			transaction: vi.fn((run) =>
				run({ select: base.select, delete: deleteRows }),
			),
		};
		await expect(
			replaceSchedules(db as never, actor, "place", []),
		).resolves.toEqual({ schedules: [], exceptions: [] });
		expect(deleteRows).toHaveBeenCalledTimes(1);
	});

	it("replaces seasons, weekdays, and intervals with the correct parent IDs", async () => {
		const base = selectRows(
			[{ id: "place", ownerId: "owner" }],
			[{ id: "season", placeId: "place" }],
			[{ id: "weekday", scheduleId: "season", weekday: 5 }],
			[{ weekdayId: "weekday", startMinute: 540, endMinute: 720 }],
			[],
		);
		const inserted: Array<{ table: unknown; values: unknown }> = [];
		const insert = vi.fn((table: unknown) => ({
			values: (values: unknown) => {
				inserted.push({ table, values });
				return {
					returning: async () => [
						{ id: table === placeHoursSchedules ? "season" : "weekday" },
					],
				};
			},
		}));
		const deleteRows = vi.fn(() => ({ where: async () => undefined }));
		const db = {
			transaction: vi.fn((run) =>
				run({ select: base.select, insert, delete: deleteRows }),
			),
		};
		const result = await replaceSchedules(db as never, actor, "place", [
			{
				validFrom: "2026-01-01",
				validTo: null,
				weekdays: [
					{
						weekday: 5,
						state: "open",
						intervals: [{ startMinute: 540, endMinute: 720 }],
					},
				],
			},
		]);
		expect(inserted).toEqual([
			{
				table: placeHoursSchedules,
				values: expect.objectContaining({
					placeId: "place",
					validFrom: "2026-01-01",
				}),
			},
			{
				table: placeHoursWeekdays,
				values: expect.objectContaining({
					scheduleId: "season",
					weekday: 5,
					state: "open",
				}),
			},
			{
				table: placeHoursIntervals,
				values: [{ weekdayId: "weekday", startMinute: 540, endMinute: 720 }],
			},
		]);
		expect(deleteRows).toHaveBeenCalledWith(placeHoursSchedules);
		expect(result.schedules[0].weekdays[0].intervals).toEqual([
			{ weekdayId: "weekday", startMinute: 540, endMinute: 720 },
		]);
	});

	it("creates a place with owner, new location, and default prices", async () => {
		const inserted: Array<{ table: unknown; values: unknown }> = [];
		const insert = vi.fn((table: unknown) => ({
			values: (values: unknown) => {
				inserted.push({ table, values });
				return {
					returning: async () => [
						{ id: table === locations ? "location" : "place" },
					],
				};
			},
		}));
		const deleteRows = vi.fn(() => ({ where: async () => undefined }));
		const db = {
			transaction: vi.fn((run) => run({ insert, delete: deleteRows })),
		};
		const input = placeInputSchema.parse({
			name: "Park",
			timezone: "UTC",
			location: { label: "Park", latitude: 40, longitude: -73 },
			prices: [{ amount: "12.00", currency: "USD", validFrom: "2026-01-01" }],
		});
		await savePlace(db as never, actor, input);
		expect(inserted).toContainEqual({
			table: places,
			values: expect.objectContaining({
				ownerId: "owner",
				locationId: "location",
				visibility: "private",
			}),
		});
		expect(inserted).toContainEqual({
			table: placePrices,
			values: [expect.objectContaining({ placeId: "place", amount: "12.00" })],
		});
		expect(deleteRows).toHaveBeenCalledWith(placePrices);
	});

	it("reuses an unchanged location when replacing a place", async () => {
		const location = {
			id: "location",
			label: "Park",
			address: null,
			latitude: 40,
			longitude: -73,
		};
		const base = selectRows(
			[{ id: "place", locationId: "location", ownerId: "owner" }],
			[location],
		);
		const returning = vi
			.fn()
			.mockResolvedValue([{ id: "place", locationId: "location" }]);
		const update = vi.fn(() => ({
			set: () => ({ where: () => ({ returning }) }),
		}));
		const deleteRows = vi.fn(() => ({ where: async () => undefined }));
		const insert = vi.fn();
		const db = {
			transaction: vi.fn((run) =>
				run({ select: base.select, update, delete: deleteRows, insert }),
			),
		};
		const input = placeInputSchema.parse({
			name: "Park",
			timezone: "UTC",
			location: { label: "Park", address: null, latitude: 40, longitude: -73 },
		});
		await expect(
			savePlace(db as never, actor, input, "place"),
		).resolves.toMatchObject({ id: "place", locationId: "location" });
		expect(update).toHaveBeenCalledWith(places);
		expect(insert).not.toHaveBeenCalledWith(locations);
	});

	it("creates a new location when an owned place moves", async () => {
		const base = selectRows(
			[{ id: "place", locationId: "old-location", ownerId: "owner" }],
			[
				{
					id: "old-location",
					label: "Old park",
					address: null,
					latitude: 40,
					longitude: -73,
				},
			],
		);
		const insert = vi.fn(() => ({
			values: () => ({ returning: async () => [{ id: "new-location" }] }),
		}));
		const set = vi.fn((values: unknown) => ({
			where: () => ({
				returning: async () => [{ id: "place", ...(values as object) }],
			}),
		}));
		const update = vi.fn(() => ({ set }));
		const deleteRows = vi.fn(() => ({ where: async () => undefined }));
		const db = {
			transaction: vi.fn((run) =>
				run({ select: base.select, insert, update, delete: deleteRows }),
			),
		};
		const input = placeInputSchema.parse({
			name: "New park",
			timezone: "UTC",
			location: { label: "New park", latitude: 41, longitude: -73 },
		});
		await expect(
			savePlace(db as never, actor, input, "place"),
		).resolves.toMatchObject({ locationId: "new-location" });
		expect(insert).toHaveBeenCalledWith(locations);
		expect(set).toHaveBeenCalledWith(
			expect.objectContaining({ locationId: "new-location" }),
		);
		expect(set.mock.calls[0][0]).not.toHaveProperty("ownerId");
	});

	it("replaces an exception's intervals after an upsert", async () => {
		const base = selectRows([{ id: "place", ownerId: "owner" }]);
		const inserted: Array<{ table: unknown; values: unknown }> = [];
		const insert = vi.fn((table: unknown) => ({
			values: (values: unknown) => {
				inserted.push({ table, values });
				return {
					onConflictDoUpdate: () => ({
						returning: async () => [{ id: "exception" }],
					}),
				};
			},
		}));
		const deleteRows = vi.fn(() => ({ where: async () => undefined }));
		const db = {
			transaction: vi.fn((run) =>
				run({ select: base.select, insert, delete: deleteRows }),
			),
		};
		await saveException(db as never, actor, "place", {
			date: "2026-12-25",
			state: "open",
			intervals: [{ startMinute: 600, endMinute: 660 }],
		});
		expect(inserted).toEqual([
			{
				table: placeHoursExceptions,
				values: expect.objectContaining({
					date: "2026-12-25",
					placeId: "place",
				}),
			},
			{
				table: placeHoursExceptionIntervals,
				values: [
					{ exceptionId: "exception", startMinute: 600, endMinute: 660 },
				],
			},
		]);
		expect(deleteRows).toHaveBeenCalledWith(placeHoursExceptionIntervals);
	});
});
