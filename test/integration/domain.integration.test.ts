import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabase } from "../../src/db/client.server";
import * as schema from "../../src/db/schema";
import {
	eventInputSchema,
	occurrenceInputSchema,
	recurrenceInputSchema,
} from "../../src/modules/events/contracts";
import {
	cancelOccurrence,
	createRecurrence,
	getEvent,
	saveEvent,
	saveOccurrence,
} from "../../src/modules/events/service.server";
import { createAuth } from "../../src/modules/identity/auth.server";
import {
	applyCatalogBatch,
	completeCatalogRun,
} from "../../src/modules/places/catalog-import.server";
import {
	exceptionSchema,
	placeInputSchema,
	scheduleSchema,
} from "../../src/modules/places/contracts";
import {
	clusterDiscovery,
	clusterQuerySchema,
	discoveryQuerySchema,
	listDiscovery,
} from "../../src/modules/places/discovery.server";
import {
	getPlace,
	replaceSchedules,
	saveException,
	savePlace,
} from "../../src/modules/places/service.server";
import { findAvailability } from "../../src/modules/planning/index.server";
import { availabilitySchema } from "../../src/shared/validation";

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
		const email = `${randomUUID()}@example.test`;
		const password = "a-strong-test-password-123!";
		const verificationLinks: string[] = [];
		const auth = createAuth(db, {
			baseURL: "http://localhost:3000",
			secret: "tardis-test-secret-at-least-thirty-two-characters",
			verificationEmail: async (_to, url) => {
				verificationLinks.push(url);
			},
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
					email,
					password,
				}),
			}),
		);
		expect(response.status).toBe(200);
		expect(response.headers.getSetCookie().join(" ")).not.toContain(
			"session_token",
		);
		expect(verificationLinks).toHaveLength(1);
		const signInRequest = () =>
			new Request("http://localhost:3000/api/auth/sign-in/email", {
				method: "POST",
				headers: {
					origin: "http://localhost:3000",
					"content-type": "application/json",
				},
				body: JSON.stringify({ email, password }),
			});
		expect((await auth.handler(signInRequest())).status).toBe(403);
		const verified = await auth.handler(new Request(verificationLinks[0]));
		expect(verified.status).toBeLessThan(400);
		const signedIn = await auth.handler(signInRequest());
		expect(signedIn.status).toBe(200);
		const cookie = signedIn.headers
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
	it("uses a one-time password reset link and revokes existing sessions", async () => {
		const email = `${randomUUID()}@example.test`;
		const oldPassword = "old-test-password-123!";
		const newPassword = "new-test-password-456!";
		const resetLinks: string[] = [];
		const auth = createAuth(db, {
			baseURL: "http://localhost:3000",
			secret: "tardis-test-secret-at-least-thirty-two-characters",
			passwordResetEmail: async (_to, url) => {
				resetLinks.push(url);
			},
		});
		const post = (path: string, body: object) =>
			auth.handler(
				new Request(`http://localhost:3000/api/auth/${path}`, {
					method: "POST",
					headers: {
						origin: "http://localhost:3000",
						"content-type": "application/json",
					},
					body: JSON.stringify(body),
				}),
			);
		const signedUp = await post("sign-up/email", {
			name: "Reset Test",
			email,
			password: oldPassword,
		});
		expect(signedUp.status).toBe(200);
		const cookie = signedUp.headers
			.getSetCookie()
			.map((part) => part.split(";")[0])
			.join("; ");
		expect(cookie).toContain("session_token");
		expect(
			(
				await post("request-password-reset", {
					email: `${randomUUID()}@example.test`,
					redirectTo: "/reset-password?next=%2Fsaved",
				})
			).status,
		).toBe(200);
		expect(resetLinks).toHaveLength(0);
		expect(
			(
				await post("request-password-reset", {
					email,
					redirectTo: "/reset-password?next=%2Fsaved",
				})
			).status,
		).toBe(200);
		expect(resetLinks).toHaveLength(1);
		const callback = await auth.handler(new Request(resetLinks[0]));
		expect(callback.status).toBe(302);
		const destination = new URL(callback.headers.get("location") ?? "");
		expect(destination.pathname).toBe("/reset-password");
		expect(destination.searchParams.get("next")).toBe("/saved");
		const token = destination.searchParams.get("token");
		expect(token).toBeTruthy();
		expect((await post("reset-password", { token, newPassword })).status).toBe(
			200,
		);
		expect((await post("reset-password", { token, newPassword })).status).toBe(
			400,
		);
		expect(
			await auth.api.getSession({ headers: new Headers({ cookie }) }),
		).toBeNull();
		expect(
			(await post("sign-in/email", { email, password: oldPassword })).status,
		).toBe(401);
		expect(
			(await post("sign-in/email", { email, password: newPassword })).status,
		).toBe(200);
	});
	it("persists account name and avatar updates and changes the password", async () => {
		const email = `${randomUUID()}@example.test`;
		const oldPassword = "old-account-password-123!";
		const newPassword = "new-account-password-456!";
		const image =
			"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=";
		const auth = createAuth(db, {
			baseURL: "http://localhost:3000",
			secret: "tardis-test-secret-at-least-thirty-two-characters",
		});
		const post = (path: string, body: object, cookie?: string) =>
			auth.handler(
				new Request(`http://localhost:3000/api/auth/${path}`, {
					method: "POST",
					headers: {
						origin: "http://localhost:3000",
						"content-type": "application/json",
						...(cookie ? { cookie } : {}),
					},
					body: JSON.stringify(body),
				}),
			);
		const signedUp = await post("sign-up/email", {
			name: "Ada Lovelace",
			email,
			password: oldPassword,
		});
		expect(signedUp.status).toBe(200);
		const cookie = signedUp.headers
			.getSetCookie()
			.map((part) => part.split(";")[0])
			.join("; ");
		expect(cookie).toContain("session_token");
		expect(
			(await post("update-user", { name: "Grace Hopper", image }, cookie))
				.status,
		).toBe(200);
		const session = await auth.api.getSession({
			headers: new Headers({ cookie }),
		});
		expect(session?.user.name).toBe("Grace Hopper");
		expect(session?.user.image).toBe(image);
		expect(
			(
				await post(
					"change-password",
					{
						currentPassword: oldPassword,
						newPassword,
						revokeOtherSessions: true,
					},
					cookie,
				)
			).status,
		).toBe(200);
		expect(
			(await post("sign-in/email", { email, password: oldPassword })).status,
		).toBe(401);
		expect(
			(await post("sign-in/email", { email, password: newPassword })).status,
		).toBe(200);
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
	it("browses catalog POIs with spatial, category, and cursor filters", async () => {
		const latitude = 36.25 + Math.random() * 0.01;
		const longitude = -120.25 + Math.random() * 0.01;
		const [site] = await db
			.insert(schema.locations)
			.values({
				label: "Catalog test park",
				latitude,
				longitude,
			})
			.returning();
		const [place] = await db
			.insert(schema.places)
			.values({
				name: "Catalog test park",
				managementKind: "catalog",
				visibility: "public",
				locationId: site.id,
				timezone: "America/Los_Angeles",
			})
			.returning();
		const [run] = await db
			.insert(schema.placeImportRuns)
			.values({
				release: "test",
				profile: "neon-free",
				selectionFingerprint: randomUUID(),
				resolvedConfig: {},
				manifestUrl: "test",
			})
			.returning();
		await db.insert(schema.placeSources).values({
			placeId: place.id,
			appliedRunId: run.id,
			provider: "overture",
			externalId: randomUUID(),
			contentHash: Buffer.alloc(32),
			category: "parks",
			attribution: "Overture Maps",
		});
		const [otherSite] = await db
			.insert(schema.locations)
			.values({
				label: "Second catalog test park",
				latitude: latitude + 0.0005,
				longitude: longitude + 0.0005,
			})
			.returning();
		const [otherPlace] = await db
			.insert(schema.places)
			.values({
				name: "Second catalog test park",
				managementKind: "catalog",
				visibility: "public",
				locationId: otherSite.id,
				timezone: "America/Los_Angeles",
			})
			.returning();
		await db.insert(schema.placeSources).values({
			placeId: otherPlace.id,
			appliedRunId: run.id,
			provider: "overture",
			externalId: randomUUID(),
			contentHash: Buffer.alloc(32),
			category: "parks",
			attribution: "Overture Maps",
		});
		await db.insert(schema.placeSources).values({
			placeId: otherPlace.id,
			appliedRunId: run.id,
			provider: "overture",
			externalId: randomUUID(),
			contentHash: Buffer.alloc(32),
			category: "landmarks",
			taxonomyPrimary: "historic_site",
			attribution: "Overture Maps",
		});
		try {
			const bounds = {
				west: longitude - 0.001,
				east: longitude + 0.001,
				south: latitude - 0.001,
				north: latitude + 0.001,
			};
			const page = await listDiscovery(db, discoveryQuerySchema.parse(bounds));
			expect(page.catalogStatus).toBe("importing");
			expect(page.items.map((item) => item.id)).toContain(place.id);
			expect(page.items.find((item) => item.id === place.id)?.hoursState).toBe(
				"unknown",
			);
			expect(
				(
					await listDiscovery(
						db,
						discoveryQuerySchema.parse({ ...bounds, category: "restaurants" }),
					)
				).items,
			).toHaveLength(0);
			expect(
				(
					await listDiscovery(
						db,
						discoveryQuerySchema.parse({ ...bounds, category: "landmarks" }),
					)
				).items,
			).toHaveLength(0);
			const firstPage = await listDiscovery(
				db,
				discoveryQuerySchema.parse({ ...bounds, limit: 1 }),
			);
			expect(firstPage.items.map((item) => item.id)).toEqual([place.id]);
			expect(firstPage.nextCursor).toBe(place.id);
			const secondPage = await listDiscovery(
				db,
				discoveryQuerySchema.parse({
					...bounds,
					limit: 1,
					cursor: firstPage.nextCursor,
				}),
			);
			expect(secondPage.items.map((item) => item.id)).toEqual([otherPlace.id]);
			const grouped = await clusterDiscovery(
				db,
				clusterQuerySchema.parse({ ...bounds, zoom: 12 }),
			);
			expect(grouped.catalogStatus).toBe("importing");
			expect(grouped.approximate).toBe(false);
			expect(
				grouped.clusters.reduce((sum, cluster) => sum + cluster.count, 0),
			).toBe(2);
			await db.insert(schema.placeClusterCells).values({
				runId: run.id,
				category: "parks",
				cellX: Math.floor((longitude + 180) / 0.703125),
				cellY: Math.floor((latitude + 90) / 0.703125),
				placeCount: 2,
				latitudeSum: latitude * 2 + 0.0005,
				longitudeSum: longitude * 2 + 0.0005,
				west: longitude,
				east: longitude + 0.0005,
				south: latitude,
				north: latitude + 0.0005,
			});
			await db
				.update(schema.placeImportRuns)
				.set({ state: "completed" })
				.where(eq(schema.placeImportRuns.id, run.id));
			const cached = await clusterDiscovery(
				db,
				clusterQuerySchema.parse({ ...bounds, zoom: 4 }),
			);
			expect(cached.approximate).toBe(true);
			expect(cached.clusters[0]?.count).toBe(2);
		} finally {
			await db
				.delete(schema.placeClusterCells)
				.where(eq(schema.placeClusterCells.runId, run.id));
			await db
				.delete(schema.placeSources)
				.where(inArray(schema.placeSources.placeId, [place.id, otherPlace.id]));
			await db
				.delete(schema.places)
				.where(inArray(schema.places.id, [place.id, otherPlace.id]));
			await db
				.delete(schema.locations)
				.where(inArray(schema.locations.id, [site.id, otherSite.id]));
			await db
				.delete(schema.placeImportRuns)
				.where(eq(schema.placeImportRuns.id, run.id));
		}
	});
	it("replays a catalog batch and preserves old venue locations after a source move", async () => {
		const client = new Client({ connectionString: databaseUrl });
		await client.connect();
		const externalId = randomUUID();
		const fingerprint = randomUUID();
		const firstRun = await client.query(
			`INSERT INTO place_import_runs (release, profile, selection_fingerprint, resolved_config, manifest_url)
			VALUES ('test-1','neon-free',$1,'{}'::jsonb,'test') RETURNING id`,
			[fingerprint],
		);
		const firstRunId = firstRun.rows[0].id as string;
		let secondRunId: string | null = null;
		let originalLocationId: string | null = null;
		const source = {
			externalId,
			name: "Test Museum",
			latitude: 40.7,
			longitude: -74,
			address: null,
			timezone: "America/New_York",
			category: "museums",
			taxonomyPrimary: "museum",
			operatingStatus: "open",
			confidence: 0.9,
			contentHash: Buffer.alloc(32, 1),
		};
		try {
			expect(
				await applyCatalogBatch(client, firstRunId, "sample", 0, [source]),
			).toEqual({ inserted: 1, updated: 0, unchanged: 0 });
			expect(
				await applyCatalogBatch(client, firstRunId, "sample", 0, [source]),
			).toEqual({ inserted: 1, updated: 0, unchanged: 0 });
			const original = await client.query(
				"SELECT place_id, location_id FROM place_sources JOIN places ON places.id=place_sources.place_id WHERE external_id=$1",
				[externalId],
			);
			originalLocationId = original.rows[0].location_id;
			await completeCatalogRun(client, firstRunId, 1, { accepted: 1 });
			const secondRun = await client.query(
				`INSERT INTO place_import_runs (release, profile, selection_fingerprint, resolved_config, manifest_url)
				VALUES ('test-2','neon-free',$1,'{}'::jsonb,'test') RETURNING id`,
				[fingerprint],
			);
			secondRunId = secondRun.rows[0].id as string;
			const moved = {
				...source,
				longitude: -73.9,
				contentHash: Buffer.alloc(32, 2),
			};
			expect(
				await applyCatalogBatch(client, secondRunId, "sample", 0, [moved]),
			).toEqual({ inserted: 0, updated: 1, unchanged: 0 });
			const current = await client.query(
				"SELECT place_id, location_id FROM place_sources JOIN places ON places.id=place_sources.place_id WHERE external_id=$1",
				[externalId],
			);
			expect(current.rows[0].place_id).toBe(original.rows[0].place_id);
			expect(current.rows[0].location_id).not.toBe(
				original.rows[0].location_id,
			);
			expect(
				(
					await client.query("SELECT 1 FROM locations WHERE id=$1", [
						original.rows[0].location_id,
					])
				).rowCount,
			).toBe(1);
			await completeCatalogRun(client, secondRunId, 1, { accepted: 1 });
		} finally {
			const linked = await client.query(
				"SELECT place_id FROM place_sources WHERE external_id=$1",
				[externalId],
			);
			if (linked.rows[0]) {
				const placeId = linked.rows[0].place_id;
				const locations = await client.query(
					"SELECT location_id FROM places WHERE id=$1",
					[placeId],
				);
				await client.query("DELETE FROM place_sources WHERE external_id=$1", [
					externalId,
				]);
				await client.query("DELETE FROM places WHERE id=$1", [placeId]);
				if (locations.rows[0])
					await client.query("DELETE FROM locations WHERE id=$1", [
						locations.rows[0].location_id,
					]);
			}
			if (originalLocationId)
				await client.query("DELETE FROM locations WHERE id=$1", [
					originalLocationId,
				]);
			await client.query(
				"DELETE FROM place_import_batches WHERE run_id IN ($1,$2)",
				[firstRunId, secondRunId],
			);
			await client.query("DELETE FROM place_import_runs WHERE id IN ($1,$2)", [
				firstRunId,
				secondRunId,
			]);
			await client.end();
		}
	});
});
