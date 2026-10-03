import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import { locations } from "../places/schema";
import { tags } from "../taxonomy/schema";
import { eventInputSchema, occurrenceInputSchema } from "./contracts";
import {
	eventDays,
	eventOccurrences,
	eventPrices,
	eventRecurrenceDays,
	eventRecurrences,
	events,
} from "./schema";
import {
	cancelOccurrence,
	createRecurrence,
	deleteEvent,
	endRecurrence,
	getEvent,
	getOccurrence,
	listEvents,
	listOccurrences,
	ownEvent,
	saveEvent,
	saveOccurrence,
} from "./service.server";

const actor = { subject: "owner" };
const event = {
	id: "event",
	ownerId: "owner",
	locationId: "location",
	placeId: null,
	timezone: "UTC",
};
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

function database(...results: unknown[][]) {
	const select = vi.fn(() => ({
		from: () => ({
			where: () => {
				const rows = results.shift() ?? [];
				return Object.assign(Promise.resolve(rows), {
					for: () => Promise.resolve(rows),
				});
			},
		}),
	}));
	return { select, transaction: vi.fn((run) => run({ select })) };
}

describe("event service ownership and recurrence boundaries", () => {
	it("locks only the actor's event when checking ownership", async () => {
		const db = capturedSelect([event]);
		await expect(ownEvent(db as never, actor, "event")).resolves.toEqual(event);
		const query = dialect.sqlToQuery(db.conditions[0] as never);
		expect(query.sql).toContain('"events"."id"');
		expect(query.sql).toContain('"events"."owner_id"');
		expect(query.params).toEqual(["event", "owner"]);
		expect(db.locks).toEqual(["update"]);
	});

	it("paginates only readable events", async () => {
		const db = capturedSelect([event]);
		await expect(
			listEvents(db as never, actor, { limit: 7, offset: 14 }),
		).resolves.toEqual([event]);
		const query = dialect.sqlToQuery(db.conditions[0] as never);
		expect(query.sql).toContain('"events"."visibility"');
		expect(query.sql).toContain('"events"."owner_id"');
		expect(query.params).toContain("owner");
		expect(db.paging).toEqual([7, 14]);
	});

	it("hides a missing or unreadable event", async () => {
		const db = capturedSelect();
		await expect(getEvent(db as never, null, "secret")).rejects.toMatchObject({
			status: 404,
		});
		const query = dialect.sqlToQuery(db.conditions[0] as never);
		expect(query.sql).toContain('"events"."visibility"');
		expect(query.params).toContain("secret");
	});

	it("assembles a readable event and assigns template days to the right recurrence", async () => {
		const rows = new Map<unknown, unknown[]>([
			[events, [{ ...event, visibility: "public" }]],
			[locations, [{ id: "location", label: "Park" }]],
			[tags, [{ id: "tag", slug: "music" }]],
			[eventPrices, [{ id: "price", eventId: "event" }]],
			[eventRecurrences, [{ id: "first" }, { id: "second" }]],
			[eventRecurrenceDays, [{ recurrenceId: "second", dayOffset: 1 }]],
		]);
		const db = {
			select: vi.fn(() => ({
				from: (table: unknown) => ({
					where: () => Promise.resolve(rows.get(table) ?? []),
					innerJoin: () => Promise.resolve(rows.get(table) ?? []),
				}),
			})),
		};
		const result = await getEvent(db as never, null, "event");
		expect(result).toMatchObject({
			id: "event",
			location: { label: "Park" },
			tags: [{ slug: "music" }],
			prices: [{ id: "price" }],
			recurrences: [
				{ id: "first", days: [] },
				{ id: "second", days: [{ dayOffset: 1 }] },
			],
		});
	});

	it("requires a readable parent before listing occurrences", async () => {
		const db = capturedSelect();
		await expect(
			listOccurrences(db as never, null, "secret", { limit: 2, offset: 4 }),
		).rejects.toMatchObject({ status: 404 });
		expect(db.select).toHaveBeenCalledTimes(1);
	});

	it("loads occurrence days and prices after checking parent visibility", async () => {
		const rows = new Map<unknown, unknown[]>([
			[events, [{ ...event, visibility: "public" }]],
			[locations, [{ id: "location", label: "Park" }]],
			[eventOccurrences, [{ id: "occurrence", locationId: "location" }]],
			[eventDays, [{ occurrenceId: "occurrence", date: "2026-09-18" }]],
			[eventPrices, [{ id: "price", occurrenceId: "occurrence" }]],
		]);
		const db = {
			select: vi.fn(() => ({
				from: (table: unknown) => ({
					where: () =>
						Object.assign(Promise.resolve(rows.get(table) ?? []), {
							orderBy: () => Promise.resolve(rows.get(table) ?? []),
						}),
					innerJoin: () => Promise.resolve([]),
				}),
			})),
		};
		await expect(
			getOccurrence(db as never, null, "event", "occurrence"),
		).resolves.toMatchObject({
			id: "occurrence",
			location: { label: "Park" },
			days: [{ date: "2026-09-18" }],
			prices: [{ id: "price" }],
		});
	});

	it("deletes an owned event after locking it", async () => {
		const base = capturedSelect([event]);
		const where = vi.fn().mockResolvedValue(undefined);
		const deleteRows = vi.fn(() => ({ where }));
		const db = {
			transaction: vi.fn((run) =>
				run({ select: base.select, delete: deleteRows }),
			),
		};
		await deleteEvent(db as never, actor, "event");
		expect(base.locks).toEqual(["update"]);
		expect(deleteRows).toHaveBeenCalledWith(events);
		expect(dialect.sqlToQuery(where.mock.calls[0][0] as never).params).toEqual([
			"event",
		]);
	});

	it("cancels only the requested occurrence of an owned event", async () => {
		const base = capturedSelect([event]);
		const returning = vi
			.fn()
			.mockResolvedValue([{ id: "occurrence", status: "cancelled" }]);
		const where = vi.fn((_condition: unknown) => ({ returning }));
		const set = vi.fn(() => ({ where }));
		const update = vi.fn(() => ({ set }));
		const db = {
			transaction: vi.fn((run) => run({ select: base.select, update })),
		};
		await expect(
			cancelOccurrence(db as never, actor, "event", "occurrence"),
		).resolves.toEqual({ id: "occurrence", status: "cancelled" });
		expect(update).toHaveBeenCalledWith(eventOccurrences);
		expect(set).toHaveBeenCalledWith({ status: "cancelled" });
		expect(dialect.sqlToQuery(where.mock.calls[0][0] as never).params).toEqual([
			"event",
			"occurrence",
		]);
	});

	it("reports a missing occurrence when cancellation updates no row", async () => {
		const base = capturedSelect([event]);
		const update = vi.fn(() => ({
			set: () => ({ where: () => ({ returning: async () => [] }) }),
		}));
		const db = {
			transaction: vi.fn((run) => run({ select: base.select, update })),
		};
		await expect(
			cancelOccurrence(db as never, actor, "event", "missing"),
		).rejects.toMatchObject({ status: 404 });
	});

	it("saves default prices against the event, not an occurrence", async () => {
		const inserted: Array<{ table: unknown; values: unknown }> = [];
		const insert = vi.fn((table: unknown) => ({
			values: (values: unknown) => {
				inserted.push({ table, values });
				return { returning: async () => [{ id: "event" }] };
			},
		}));
		const where = vi.fn().mockResolvedValue(undefined);
		const deleteRows = vi.fn(() => ({ where }));
		const db = {
			transaction: vi.fn((run) => run({ insert, delete: deleteRows })),
		};
		const input = eventInputSchema.parse({
			title: "Market",
			timezone: "UTC",
			location: { label: "Park", latitude: 40, longitude: -73 },
			prices: [{ amount: "10.00", currency: "USD", validFrom: "2026-01-01" }],
		});
		await saveEvent(db as never, actor, input);
		expect(inserted).toContainEqual({
			table: eventPrices,
			values: [expect.objectContaining({ eventId: "event", amount: "10.00" })],
		});
		expect(deleteRows).toHaveBeenCalledWith(eventPrices);
		const priceDeletion = dialect.sqlToQuery(
			where.mock.calls[where.mock.calls.length - 1][0],
		);
		expect(priceDeletion.sql).toContain("is null");
		expect(priceDeletion.params).toEqual(["event"]);
	});
	it("rejects an event the actor does not own", async () => {
		const db = database([]);
		await expect(ownEvent(db as never, actor, "event")).rejects.toMatchObject({
			status: 404,
		});
	});

	it("rejects a recurrence segment that overlaps the existing segment", async () => {
		const db = database(
			[event],
			[{ anchorDate: "2026-01-01", untilDate: "2026-12-31" }],
		);
		await expect(
			createRecurrence(db as never, actor, "event", {
				mode: "scheduled",
				anchorDate: "2026-06-01",
				untilDate: null,
				rrule: "FREQ=DAILY",
				intervalMonths: null,
				days: [],
			}),
		).rejects.toMatchObject({ status: 409 });
	});

	it("does not let an ended recurrence extend beyond its old end", async () => {
		const db = database(
			[event],
			[{ id: "rule", anchorDate: "2026-01-01", untilDate: "2026-06-30" }],
		);
		await expect(
			endRecurrence(db as never, actor, "event", "rule", "2026-07-01"),
		).rejects.toMatchObject({ status: 409 });
	});

	it("requires future explicit occurrences to be cancelled before shortening a rule", async () => {
		const db = database(
			[event],
			[{ id: "rule", anchorDate: "2026-01-01", untilDate: null }],
			[{ originalAnchor: "2026-06-01", status: "scheduled" }],
		);
		await expect(
			endRecurrence(db as never, actor, "event", "rule", "2026-05-31"),
		).rejects.toMatchObject({ status: 409 });
	});

	it("allows a recurrence to end after future occurrences are cancelled", async () => {
		const base = database(
			[event],
			[{ id: "rule", anchorDate: "2026-01-01", untilDate: null }],
			[{ originalAnchor: "2026-06-01", status: "cancelled" }],
		);
		const returning = vi
			.fn()
			.mockResolvedValue([{ id: "rule", untilDate: "2026-05-31" }]);
		const where = vi.fn(() => ({ returning }));
		const set = vi.fn(() => ({ where }));
		const update = vi.fn(() => ({ set }));
		const db = {
			transaction: vi.fn((run) => run({ select: base.select, update })),
		};
		await expect(
			endRecurrence(db as never, actor, "event", "rule", "2026-05-31"),
		).resolves.toEqual({ id: "rule", untilDate: "2026-05-31" });
		expect(update).toHaveBeenCalledWith(eventRecurrences);
		expect(set).toHaveBeenCalledWith({ untilDate: "2026-05-31" });
	});

	it("rejects duplicate price windows before starting an event transaction", async () => {
		const price = { amount: "10.00", currency: "USD", validFrom: "2026-01-01" };
		const input = eventInputSchema.parse({
			title: "Market",
			timezone: "UTC",
			placeId: "550e8400-e29b-41d4-a716-446655440000",
			prices: [price, price],
		});
		const transaction = vi.fn();
		await expect(
			saveEvent({ transaction } as never, actor, input),
		).rejects.toMatchObject({ status: 409 });
		expect(transaction).not.toHaveBeenCalled();
	});

	it("requires a venue even if a caller bypasses input parsing", async () => {
		const input = eventInputSchema.parse({
			title: "Market",
			timezone: "UTC",
			placeId: "550e8400-e29b-41d4-a716-446655440000",
		});
		const transaction = vi.fn((run) => run({}));
		await expect(
			saveEvent({ transaction } as never, actor, {
				...input,
				placeId: undefined,
			}),
		).rejects.toMatchObject({ status: 400 });
	});

	it("preserves an occurrence's original recurrence identity", async () => {
		const base = database(
			[event],
			[
				{
					id: "occurrence",
					recurrenceId: "series",
					originalAnchor: "2026-09-18",
				},
			],
		);
		const input = occurrenceInputSchema.parse({
			datePrecision: "exact",
			days: [{ date: "2026-09-18", timeKind: "all_day" }],
		});
		await expect(
			saveOccurrence(base as never, actor, "event", input, "occurrence"),
		).rejects.toMatchObject({ status: 409 });
	});

	it("creates a month placeholder for an expected recurrence", async () => {
		const base = database([event], []);
		const inserted: Array<{ table: unknown; values: unknown }> = [];
		const insert = vi.fn((table: unknown) => ({
			values: (values: unknown) => {
				inserted.push({ table, values });
				return {
					returning: async () =>
						table === eventRecurrences
							? [{ id: "series" }]
							: [{ id: "placeholder" }],
				};
			},
		}));
		const db = {
			transaction: vi.fn((run) => run({ select: base.select, insert })),
		};
		const result = await createRecurrence(db as never, actor, "event", {
			mode: "expected",
			anchorDate: "2026-09-18",
			untilDate: null,
			rrule: null,
			intervalMonths: 2,
			days: [],
		});
		expect(result.placeholder).toEqual({ id: "placeholder" });
		expect(inserted).toEqual([
			{
				table: eventRecurrences,
				values: expect.objectContaining({ eventId: "event", mode: "expected" }),
			},
			{
				table: eventOccurrences,
				values: expect.objectContaining({
					expectedMonth: "2026-11-01",
					originalAnchor: "2026-11-01",
					status: "tentative",
				}),
			},
		]);
	});

	it("stores scheduled recurrence days without creating a month placeholder", async () => {
		const base = database([event], []);
		const inserted: Array<{ table: unknown; values: unknown }> = [];
		const insert = vi.fn((table: unknown) => ({
			values: (values: unknown) => {
				inserted.push({ table, values });
				return { returning: async () => [{ id: "series" }] };
			},
		}));
		const db = {
			transaction: vi.fn((run) => run({ select: base.select, insert })),
		};
		const days = [{ dayOffset: 0, timeKind: "all_day" as const }];
		await expect(
			createRecurrence(db as never, actor, "event", {
				mode: "scheduled",
				anchorDate: "2026-09-18",
				untilDate: null,
				rrule: "FREQ=WEEKLY",
				intervalMonths: null,
				days,
			}),
		).resolves.toMatchObject({ id: "series", days, placeholder: null });
		expect(inserted).toEqual([
			{
				table: eventRecurrences,
				values: expect.objectContaining({
					eventId: "event",
					mode: "scheduled",
				}),
			},
			{
				table: eventRecurrenceDays,
				values: [{ ...days[0], recurrenceId: "series" }],
			},
		]);
	});

	it("advances an expected recurrence when its month is confirmed", async () => {
		const seriesId = "550e8400-e29b-41d4-a716-446655440000";
		const base = database(
			[event],
			[
				{
					id: "occurrence",
					recurrenceId: seriesId,
					originalAnchor: "2026-09-01",
					datePrecision: "month",
					placeId: null,
					locationId: "location",
					timezone: "UTC",
				},
			],
			[
				{
					id: seriesId,
					eventId: "event",
					anchorDate: "2026-01-01",
					untilDate: null,
					mode: "expected",
					intervalMonths: 2,
				},
			],
		);
		const inserted: Array<{ table: unknown; values: unknown }> = [];
		const insert = vi.fn((table: unknown) => ({
			values: (values: unknown) => {
				inserted.push({ table, values });
				return { onConflictDoNothing: async () => undefined };
			},
		}));
		const returning = vi
			.fn()
			.mockResolvedValue([{ id: "occurrence", eventId: "event" }]);
		const update = vi.fn(() => ({
			set: () => ({ where: () => ({ returning }) }),
		}));
		const deleteRows = vi.fn(() => ({ where: async () => undefined }));
		const db = {
			transaction: vi.fn((run) =>
				run({ select: base.select, update, insert, delete: deleteRows }),
			),
		};
		const input = occurrenceInputSchema.parse({
			datePrecision: "exact",
			status: "scheduled",
			recurrenceId: seriesId,
			originalAnchor: "2026-09-01",
			days: [{ date: "2026-09-18", timeKind: "all_day" }],
		});
		await saveOccurrence(db as never, actor, "event", input, "occurrence");
		expect(update).toHaveBeenCalledWith(eventOccurrences);
		expect(inserted).toContainEqual({
			table: eventOccurrences,
			values: expect.objectContaining({
				recurrenceId: seriesId,
				originalAnchor: "2026-11-01",
				expectedMonth: "2026-11-01",
				status: "tentative",
			}),
		});
	});

	it("creates an event with a standalone location and owner", async () => {
		const inserted: Array<{ table: unknown; values: unknown }> = [];
		const insert = vi.fn((table: unknown) => ({
			values: (values: unknown) => {
				inserted.push({ table, values });
				return {
					returning: async () =>
						table === locations
							? [{ id: "location" }]
							: [{ id: "event", ownerId: "owner", locationId: "location" }],
				};
			},
		}));
		const deleteRows = vi.fn(() => ({ where: async () => undefined }));
		const db = {
			transaction: vi.fn((run) => run({ insert, delete: deleteRows })),
		};
		const input = eventInputSchema.parse({
			title: "Market",
			timezone: "UTC",
			location: { label: "Park", latitude: 40, longitude: -73 },
		});
		await expect(saveEvent(db as never, actor, input)).resolves.toMatchObject({
			id: "event",
			ownerId: "owner",
		});
		expect(inserted).toContainEqual({
			table: events,
			values: expect.objectContaining({
				ownerId: "owner",
				locationId: "location",
				visibility: "private",
			}),
		});
	});

	it("updates an owned event without changing its owner", async () => {
		const base = database([event]);
		const set = vi.fn((values: unknown) => ({
			where: () => ({
				returning: async () => [{ ...event, ...(values as object) }],
			}),
		}));
		const update = vi.fn(() => ({ set }));
		const insert = vi.fn(() => ({
			values: () => ({ returning: async () => [{ id: "new-location" }] }),
		}));
		const deleteRows = vi.fn(() => ({ where: async () => undefined }));
		const db = {
			transaction: vi.fn((run) =>
				run({ select: base.select, update, insert, delete: deleteRows }),
			),
		};
		const input = eventInputSchema.parse({
			title: "Updated market",
			timezone: "UTC",
			location: { label: "New park", latitude: 41, longitude: -73 },
		});
		await expect(
			saveEvent(db as never, actor, input, "event"),
		).resolves.toMatchObject({
			id: "event",
			ownerId: "owner",
			title: "Updated market",
			locationId: "new-location",
		});
		expect(update).toHaveBeenCalledWith(events);
		expect(set).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "Updated market",
				locationId: "new-location",
			}),
		);
		expect(set.mock.calls[0][0]).not.toHaveProperty("ownerId");
	});

	it("rejects an update for an occurrence that does not exist", async () => {
		const db = database([event], []);
		const input = occurrenceInputSchema.parse({
			datePrecision: "exact",
			days: [{ date: "2026-09-18", timeKind: "all_day" }],
		});
		await expect(
			saveOccurrence(db as never, actor, "event", input, "missing"),
		).rejects.toMatchObject({ status: 404 });
	});

	it("rejects a recurrence override whose rule is missing", async () => {
		const db = database([event], []);
		const input = occurrenceInputSchema.parse({
			datePrecision: "exact",
			recurrenceId: "550e8400-e29b-41d4-a716-446655440000",
			originalAnchor: "2026-09-18",
			days: [{ date: "2026-09-18", timeKind: "all_day" }],
		});
		await expect(
			saveOccurrence(db as never, actor, "event", input),
		).rejects.toMatchObject({ status: 404 });
	});

	it("stores an overnight occurrence with its exclusive end date", async () => {
		const base = database([event]);
		const inserted: Array<{ table: unknown; values: unknown }> = [];
		const insert = vi.fn((table: unknown) => ({
			values: (values: unknown) => {
				inserted.push({ table, values });
				return {
					returning: async () => [{ id: "occurrence", eventId: "event" }],
				};
			},
		}));
		const deleteRows = vi.fn(() => ({ where: async () => undefined }));
		const db = {
			transaction: vi.fn((run) =>
				run({ select: base.select, insert, delete: deleteRows }),
			),
		};
		const input = occurrenceInputSchema.parse({
			datePrecision: "exact",
			status: "scheduled",
			days: [
				{
					date: "2026-09-18",
					timeKind: "timed",
					startMinute: 1320,
					endMinute: 1560,
				},
			],
		});
		const result = await saveOccurrence(db as never, actor, "event", input);
		expect(result.days).toEqual([
			expect.objectContaining({
				date: "2026-09-18",
				startsAt: new Date("2026-09-18T22:00:00Z"),
				endsAt: new Date("2026-09-19T02:00:00Z"),
			}),
		]);
		expect(inserted).toContainEqual({
			table: eventOccurrences,
			values: expect.objectContaining({
				startsOn: "2026-09-18",
				endsOn: "2026-09-20",
				eventId: "event",
			}),
		});
	});

	it("reports a daylight-saving gap as a client error before writing", async () => {
		const nyEvent = { ...event, timezone: "America/New_York" };
		const base = database([nyEvent]);
		const insert = vi.fn();
		const db = {
			transaction: vi.fn((run) => run({ select: base.select, insert })),
		};
		const input = occurrenceInputSchema.parse({
			datePrecision: "exact",
			days: [
				{
					date: "2026-03-08",
					timeKind: "timed",
					startMinute: 150,
					endMinute: 240,
				},
			],
		});
		await expect(
			saveOccurrence(db as never, actor, "event", input),
		).rejects.toMatchObject({ status: 400 });
		expect(insert).not.toHaveBeenCalled();
	});

	it("requires a new location when detaching an occurrence from its place", async () => {
		const placedEvent = { ...event, placeId: "place" };
		const base = database([placedEvent]);
		const input = occurrenceInputSchema.parse({
			datePrecision: "exact",
			placeId: null,
			days: [{ date: "2026-09-18", timeKind: "all_day" }],
		});
		await expect(
			saveOccurrence(base as never, actor, "event", input),
		).rejects.toMatchObject({ status: 400 });
	});

	it("rejects recurrence overrides outside the rule's anchor range", async () => {
		const base = database(
			[event],
			[
				{
					id: "series",
					eventId: "event",
					anchorDate: "2026-09-18",
					untilDate: "2026-09-30",
				},
			],
		);
		const input = occurrenceInputSchema.parse({
			datePrecision: "exact",
			recurrenceId: "550e8400-e29b-41d4-a716-446655440000",
			originalAnchor: "2026-10-01",
			days: [{ date: "2026-10-01", timeKind: "all_day" }],
		});
		await expect(
			saveOccurrence(base as never, actor, "event", input),
		).rejects.toMatchObject({ status: 409 });
	});
});
