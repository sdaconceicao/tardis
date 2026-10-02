import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../db/client.server";
import * as schema from "../db/schema";
import {
	eventInputSchema,
	occurrenceInputSchema,
	recurrenceInputSchema,
} from "../modules/events/contracts";
import {
	cancelOccurrence,
	createRecurrence,
	getEvent,
	saveEvent,
	saveOccurrence,
} from "../modules/events/service.server";
import { createAuth } from "../modules/identity/auth.server";
import {
	exceptionSchema,
	placeInputSchema,
	scheduleSchema,
} from "../modules/places/contracts";
import {
	getPlace,
	replaceSchedules,
	saveException,
	savePlace,
} from "../modules/places/service.server";
import { findAvailability } from "../modules/planning/index.server";
import { availabilitySchema } from "../shared/validation";

const databaseUrl = process.env.TEST_DATABASE_URL;
const suite = describe.skipIf(!databaseUrl);
suite("PostGIS domain integration", () => {
	const db = createDatabase(
		databaseUrl ?? "postgresql://localhost/unused_test",
	);
	const actor = { subject: randomUUID() },
		other = { subject: randomUUID() };
	const location = { label: "Test location", latitude: 40, longitude: -75 };
	const query = (at: string) =>
		availabilitySchema.parse({
			at,
			latitude: 40,
			longitude: -75,
			radiusMeters: 1000,
			limit: 100,
		});
	const eventInput = (visibility: "public" | "private" = "public") =>
		eventInputSchema.parse({
			title: `Test ${randomUUID()}`,
			visibility,
			timezone: "America/New_York",
			location,
		});
	const placeInput = (visibility: "public" | "private" = "public") =>
		placeInputSchema.parse({
			name: `Test ${randomUUID()}`,
			visibility,
			timezone: "America/New_York",
			location,
		});
	beforeAll(async () => {
		if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith("_test"))
			throw new Error(
				"TEST_DATABASE_URL must target a disposable database ending in _test",
			);
		await migrate(db, { migrationsFolder: "drizzle" });
		await db.insert(schema.user).values(
			[actor, other].map((a) => ({
				id: a.subject,
				name: "Test",
				email: `${a.subject}@example.test`,
			})),
		);
	}, 30000);
	afterAll(async () => {
		await db.$client.end();
	});
	it("supports Better Auth sign-up, verified sessions, and sign-out", async () => {
		const auth = createAuth(db, {
			baseURL: "http://localhost:3000",
			secret: "tardis-test-secret-at-least-thirty-two-characters",
		});
		const response = await auth.handler(
			new Request("http://localhost:3000/api/auth/sign-up/email", {
				method: "POST",
				headers: {
					origin: "http://localhost:3000",
					"content-type": "application/json",
				},
				body: JSON.stringify({
					name: "Test",
					email: `${randomUUID()}@example.test`,
					password: "a-strong-test-password-123!",
				}),
			}),
		);
		expect(response.status).toBe(200);
		const cookie = response.headers
			.getSetCookie()
			.map((c) => c.split(";")[0])
			.join("; ");
		expect(cookie).toContain("session_token");
		const session = await auth.api.getSession({
			headers: new Headers({ cookie }),
		});
		expect(session?.user.id).toBeTruthy();
		const logout = await auth.handler(
			new Request("http://localhost:3000/api/auth/sign-out", {
				method: "POST",
				headers: {
					origin: "http://localhost:3000",
					"content-type": "application/json",
					cookie,
				},
				body: "{}",
			}),
		);
		expect(logout.status).toBe(200);
		expect(
			await auth.api.getSession({ headers: new Headers({ cookie }) }),
		).toBeNull();
	});
	it("finds fair days at opening, excludes closing and unknown hours", async () => {
		const event = await saveEvent(db, actor, eventInput());
		const occurrence = await saveOccurrence(
			db,
			actor,
			event.id,
			occurrenceInputSchema.parse({
				datePrecision: "exact",
				days: [
					{
						date: "2026-09-18",
						timeKind: "timed",
						startMinute: 540,
						endMinute: 1020,
					},
					{ date: "2026-09-19", timeKind: "unknown" },
					{
						date: "2026-09-20",
						timeKind: "timed",
						startMinute: 540,
						endMinute: 900,
					},
				],
			}),
		);
		const open = await findAvailability(
			db,
			null,
			query("2026-09-20T13:00:00Z"),
		);
		expect(open.items.some((i) => i.id === occurrence.id)).toBe(true);
		expect(
			(
				await findAvailability(db, null, query("2026-09-20T19:00:00Z"))
			).items.some((i) => i.id === occurrence.id),
		).toBe(false);
		expect(
			(
				await findAvailability(db, null, query("2026-09-19T14:00:00Z"))
			).items.some((i) => i.id === occurrence.id),
		).toBe(false);
	});
	it("rejects private reads and writes from another actor", async () => {
		const event = await saveEvent(db, actor, eventInput("private"));
		await expect(getEvent(db, null, event.id)).rejects.toMatchObject({
			status: 404,
		});
		await expect(
			saveEvent(db, other, eventInput(), event.id),
		).rejects.toMatchObject({ status: 404 });
		expect((await getEvent(db, actor, event.id)).id).toBe(event.id);
	});
	it("enforces venue privacy in both directions and preserves atomic writes", async () => {
		const input = placeInput("private");
		const place = await savePlace(db, actor, input);
		await expect(
			saveEvent(
				db,
				actor,
				eventInputSchema.parse({
					title: "Public",
					visibility: "public",
					timezone: "UTC",
					placeId: place.id,
				}),
			),
		).rejects.toMatchObject({ status: 409 });
		const publicPlace = await savePlace(
			db,
			actor,
			{ ...input, visibility: "public" },
			place.id,
		);
		await saveEvent(
			db,
			actor,
			eventInputSchema.parse({
				title: "Public",
				visibility: "public",
				timezone: "UTC",
				placeId: publicPlace.id,
			}),
		);
		await expect(savePlace(db, actor, input, place.id)).rejects.toThrow();
		expect((await getPlace(db, null, place.id)).visibility).toBe("public");
	});
	it("supports overnight events and local all-day bounds", async () => {
		const event = await saveEvent(db, actor, eventInput());
		const occurrence = await saveOccurrence(
			db,
			actor,
			event.id,
			occurrenceInputSchema.parse({
				datePrecision: "exact",
				days: [
					{
						date: "2026-09-18",
						timeKind: "timed",
						startMinute: 1320,
						endMinute: 1560,
					},
				],
			}),
		);
		expect(
			(
				await findAvailability(db, null, query("2026-09-19T05:00:00Z"))
			).items.some((i) => i.id === occurrence.id),
		).toBe(true);
		const allDay = await saveOccurrence(
			db,
			actor,
			event.id,
			occurrenceInputSchema.parse({
				datePrecision: "exact",
				days: [{ date: "2026-03-08", timeKind: "all_day" }],
			}),
		);
		expect(
			Number(allDay.days[0].endsAt) - Number(allDay.days[0].startsAt),
		).toBe(23 * 3600000);
	});
	it("supports all-day events when a timezone repeats midnight", async () => {
		const event = await saveEvent(db, actor, eventInput());
		const occurrence = await saveOccurrence(
			db,
			actor,
			event.id,
			occurrenceInputSchema.parse({
				datePrecision: "exact",
				timezone: "America/Havana",
				days: [{ date: "2026-11-01", timeKind: "all_day" }],
			}),
		);
		expect(
			Number(occurrence.days[0].endsAt) - Number(occurrence.days[0].startsAt),
		).toBe(25 * 3600000);
	});
	it("expands recurrence and lets a moved or cancelled occurrence replace its anchor", async () => {
		const event = await saveEvent(db, actor, eventInput());
		const rule = await createRecurrence(
			db,
			actor,
			event.id,
			recurrenceInputSchema.parse({
				mode: "scheduled",
				anchorDate: "2026-09-18",
				rrule: "FREQ=WEEKLY",
				days: [
					{
						dayOffset: 0,
						timeKind: "timed",
						startMinute: 540,
						endMinute: 1020,
					},
				],
			}),
		);
		const at = query("2026-09-25T14:00:00Z");
		expect(
			(await findAvailability(db, null, at)).items.some(
				(i) => i.id === `${rule.id}:2026-09-25`,
			),
		).toBe(true);
		const moved = await saveOccurrence(
			db,
			actor,
			event.id,
			occurrenceInputSchema.parse({
				datePrecision: "exact",
				recurrenceId: rule.id,
				originalAnchor: "2026-09-25",
				days: [
					{
						date: "2026-09-26",
						timeKind: "timed",
						startMinute: 540,
						endMinute: 1020,
					},
				],
			}),
		);
		expect(
			(await findAvailability(db, null, at)).items.some(
				(i) => i.kind === "event" && i.eventId === event.id,
			),
		).toBe(false);
		expect(
			(
				await findAvailability(db, null, query("2026-09-26T14:00:00Z"))
			).items.some((i) => i.id === moved.id),
		).toBe(true);
		await cancelOccurrence(db, actor, event.id, moved.id);
		expect(
			(
				await findAvailability(db, null, query("2026-09-26T14:00:00Z"))
			).items.some((i) => i.id === moved.id),
		).toBe(false);
	});
	it("creates every-two-year month placeholders and confirms the same ID", async () => {
		const event = await saveEvent(db, actor, eventInput());
		const rule = await createRecurrence(
			db,
			actor,
			event.id,
			recurrenceInputSchema.parse({
				mode: "expected",
				anchorDate: "2026-09-18",
				intervalMonths: 24,
			}),
		);
		expect(rule.placeholder?.expectedMonth).toBe("2028-09-01");
		if (!rule.placeholder) throw new Error("Missing placeholder");
		expect(
			(
				await findAvailability(db, null, query("2028-09-20T14:00:00Z"))
			).items.some((i) => i.id === rule.placeholder?.id),
		).toBe(false);
		const confirmed = await saveOccurrence(
			db,
			actor,
			event.id,
			occurrenceInputSchema.parse({
				datePrecision: "exact",
				recurrenceId: rule.id,
				originalAnchor: "2028-09-01",
				days: [
					{
						date: "2028-09-20",
						timeKind: "timed",
						startMinute: 540,
						endMinute: 1020,
					},
				],
			}),
			rule.placeholder.id,
		);
		expect(confirmed.id).toBe(rule.placeholder.id);
		const next = await db
			.select()
			.from(schema.eventOccurrences)
			.where(
				and(
					eq(schema.eventOccurrences.recurrenceId, rule.id),
					eq(schema.eventOccurrences.datePrecision, "month"),
				),
			);
		expect(next.map((o) => o.expectedMonth)).toContain("2030-09-01");
	});
	it("uses seasonal hours, lunch breaks, date closures, and matching prices", async () => {
		const input = placeInput();
		input.prices = [
			{
				label: "Admission",
				category: "general",
				coverage: "admission",
				amount: "15.00",
				currency: "USD",
				validFrom: "2026-06-01",
				validTo: "2026-10-01",
				weekdays: [1, 2, 3, 4, 5, 6, 7],
				startMinute: 0,
				endMinute: 1440,
			},
		];
		const place = await savePlace(db, actor, input);
		await replaceSchedules(db, actor, place.id, [
			scheduleSchema.parse({
				validFrom: "2026-06-01",
				validTo: "2026-10-01",
				weekdays: [
					{
						weekday: 5,
						state: "open",
						intervals: [
							{ startMinute: 540, endMinute: 720 },
							{ startMinute: 780, endMinute: 1020 },
						],
					},
				],
			}),
		]);
		const result = await findAvailability(
			db,
			null,
			query("2026-09-18T14:00:00Z"),
		);
		expect(result.items.find((i) => i.id === place.id)?.prices[0].amount).toBe(
			"15.00",
		);
		expect(
			(
				await findAvailability(db, null, query("2026-09-18T16:30:00Z"))
			).items.some((i) => i.id === place.id),
		).toBe(false);
		await saveException(
			db,
			actor,
			place.id,
			exceptionSchema.parse({ date: "2026-09-18", state: "closed" }),
		);
		expect(
			(
				await findAvailability(db, null, query("2026-09-18T14:00:00Z"))
			).items.some((i) => i.id === place.id),
		).toBe(false);
	});
	it("rejects direct database violations and rolls back orphaned aggregate writes", async () => {
		const event = await saveEvent(db, actor, eventInput());
		await expect(
			db.insert(schema.eventOccurrences).values({
				eventId: event.id,
				locationId: event.locationId,
				timezone: "UTC",
				datePrecision: "exact",
				startsOn: "2026-09-18",
				endsOn: "2026-09-19",
			}),
		).rejects.toThrow();
		expect(
			await db
				.select()
				.from(schema.eventOccurrences)
				.where(eq(schema.eventOccurrences.eventId, event.id)),
		).toHaveLength(0);
		await expect(
			db.transaction(async (tx) => {
				await tx.insert(schema.eventRecurrences).values({
					eventId: event.id,
					mode: "expected",
					anchorDate: "2026-01-01",
					intervalMonths: 12,
				});
				await tx.insert(schema.eventRecurrences).values({
					eventId: event.id,
					mode: "expected",
					anchorDate: "2026-06-01",
					intervalMonths: 12,
				});
			}),
		).rejects.toThrow();
	});
	it("serializes public event creation against making a place private", async () => {
		const input = placeInput();
		const place = await savePlace(db, actor, input);
		let release!: () => void;
		let acquired!: () => void;
		const gate = new Promise<void>((r) => {
			release = r;
		});
		const ready = new Promise<void>((r) => {
			acquired = r;
		});
		const publishing = db.transaction(async (tx) => {
			await tx.insert(schema.events).values({
				ownerId: actor.subject,
				title: "Concurrent",
				visibility: "public",
				locationId: place.locationId,
				placeId: place.id,
				timezone: "UTC",
			});
			acquired();
			await gate;
		});
		await ready;
		const privacy = db.transaction(async (tx) => {
			await tx
				.update(schema.places)
				.set({ visibility: "private" })
				.where(eq(schema.places.id, place.id));
		});
		release();
		const results = await Promise.allSettled([publishing, privacy]);
		expect(results[0].status).toBe("fulfilled");
		expect(results[1].status).toBe("rejected");
		expect(
			await db
				.select()
				.from(schema.places)
				.where(
					and(
						eq(schema.places.id, place.id),
						eq(schema.places.visibility, "public"),
					),
				),
		).toHaveLength(1);
	});
	it("rejects missing expected cadence and empty scheduled templates", async () => {
		const event = await saveEvent(db, actor, eventInput());
		await expect(
			db.insert(schema.eventRecurrences).values({
				eventId: event.id,
				mode: "expected",
				anchorDate: "2026-01-01",
			}),
		).rejects.toThrow();
		await expect(
			db.insert(schema.eventRecurrences).values({
				eventId: event.id,
				mode: "scheduled",
				anchorDate: "2026-01-01",
				rrule: "FREQ=DAILY",
			}),
		).rejects.toThrow();
	});
	it("has the spatial and event time indexes", async () => {
		const indexes = await db.execute(
			sql`SELECT indexname FROM pg_indexes WHERE schemaname='public'`,
		);
		expect(indexes.rows.map((r) => r.indexname)).toEqual(
			expect.arrayContaining([
				"locations_point_idx",
				"event_day_availability_idx",
			]),
		);
	});
});
