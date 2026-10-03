import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";
import { createDatabase } from "../../../src/db/client.server";
import { user } from "../../../src/modules/identity/schema";
import { createAuth } from "../../../src/modules/identity/auth.server";

const base = process.env.TEST_API_URL;
const databaseUrl = process.env.TEST_DATABASE_URL;
const secret = process.env.BETTER_AUTH_SECRET;

test("serves authenticated domain APIs with CORS and ownership boundaries", async ({ request }) => {
	if (process.env.CI && (!base || !databaseUrl || !secret)) {
		throw new Error("CI requires TEST_API_URL, TEST_DATABASE_URL, and BETTER_AUTH_SECRET");
	}
	test.skip(!base || !databaseUrl || !secret, "Requires a disposable test server and database");
	if (!base || !databaseUrl || !secret) return;
	if (process.env.DATABASE_URL !== databaseUrl) {
		throw new Error("The app and API test must use the same disposable database");
	}
	const origin = new URL(base).origin;
	if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname)) {
		throw new Error("TEST_API_URL must point to a disposable local server");
	}
	if (!new URL(databaseUrl).pathname.endsWith("_test")) {
		throw new Error("TEST_DATABASE_URL must point to a disposable test database");
	}
	const db = createDatabase(databaseUrl);
	const auth = createAuth(db, { baseURL: origin, secret });
	const externalOrigin = "http://localhost:4321";

	async function signUp() {
		const email = `${randomUUID()}@example.test`;
		const password = "http-test-password-123!";
		const response = await auth.handler(
			new Request(`${origin}/api/auth/sign-up/email`, {
				method: "POST",
				headers: { origin, "content-type": "application/json" },
				body: JSON.stringify({
					name: "HTTP test",
					email,
					password,
				}),
			}),
		);
		expect(response.status).toBe(200);
		const cookie = response.headers
			.getSetCookie()
			.map((part) => part.split(";")[0])
			.join("; ");
		expect(cookie).toContain("session_token");
		const data = await response.json();
		return {
			cookie,
			email,
			password,
			userId: data.user.id as string,
			token: response.headers.get("set-auth-token"),
			unsignedToken: data.token as string,
		};
	}

	async function call(
		path: string,
		method = "GET",
		body?: unknown,
		cookie?: string,
	) {
		const response = await request.fetch(`${origin}${path}`, {
			method,
			headers: {
				origin,
				...(cookie ? { cookie } : {}),
			},
			...(body === undefined ? {} : { data: body }),
		});
		const data = response.status() === 204 ? null : await response.json();
		return { response, data };
	}

	try {
		const owner = await signUp();
		const token = owner.token;
		expect(token).toBeTruthy();

		await test.step("enforces HTTP and CORS boundaries", async () => {
			await db.update(user).set({ emailVerified: true }).where(eq(user.id, owner.userId));
			const login = await fetch(`${origin}/api/auth/sign-in/email`, {
				method: "POST",
				headers: { origin: externalOrigin, "content-type": "application/json" },
				body: JSON.stringify({ email: owner.email, password: owner.password }),
			});
			expect(login.status).toBe(200);
			expect(login.headers.get("set-auth-token")).toBeTruthy();
			expect(login.headers.get("access-control-allow-origin")).toBe(externalOrigin);
			expect(login.headers.get("access-control-expose-headers")).toContain("set-auth-token");
			const unsigned = await request.get(`${origin}/api/v1/events`, {
				headers: { authorization: `Bearer ${owner.unsignedToken}` },
			});
			expect(unsigned.status()).toBe(401);
			const preflight = await request.fetch(`${origin}/api/v1/events`, {
				method: "OPTIONS",
				headers: {
					origin: externalOrigin,
					"Access-Control-Request-Method": "POST",
					"Access-Control-Request-Headers": "authorization, content-type",
				},
			});
			expect(preflight.status()).toBe(204);
			expect(preflight.headers()["access-control-allow-origin"]).toBe(externalOrigin);
			expect((await request.fetch(`${origin}/api/auth/sign-in/email`, {
				method: "OPTIONS",
				headers: {
					origin: externalOrigin,
					"Access-Control-Request-Method": "POST",
					"Access-Control-Request-Headers": "content-type",
				},
			})).status()).toBe(204);
			const denied = await request.fetch(`${origin}/api/v1/events`, {
				method: "OPTIONS",
				headers: {
					origin: "http://evil.example",
					"Access-Control-Request-Method": "POST",
				},
			});
			expect(denied.status()).toBe(403);
			expect((await request.patch(`${origin}/api/v1/events`)).status()).toBe(405);
			expect((await request.get(`${origin}/api/v1/missing`)).status()).toBe(404);
			const authSpec = await request.get(`${origin}/api/auth/open-api/generate-schema`);
			expect(authSpec.status()).toBe(200);
			expect((await authSpec.json()).paths).toBeTruthy();
		});

		const tag = await call(
			"/api/v1/tags",
			"POST",
			{ slug: `smoke-${randomUUID()}`, name: "HTTP tag" },
			owner.cookie,
		);
		expect(tag.response.status()).toBe(201);
		const eventInput = {
			title: "HTTP fair",
			visibility: "public",
			timezone: "America/New_York",
			location: { label: "HTTP location", latitude: 40, longitude: -75 },
			tagIds: [tag.data.id],
		};
		const event = await call("/api/v1/events", "POST", eventInput, owner.cookie);
		expect(event.response.status()).toBe(201);
		expect(event.data.ownerId).toBeUndefined();
		const eventId = event.data.id;
		expect((await request.get(`${origin}/api/events/${eventId}`)).status()).toBe(200);
		expect((await call("/api/v1/events")).response.status()).toBe(200);
		expect((await call("/api/v1/tags?q=HTTP")).response.status()).toBe(200);

		await test.step("validates bearer authentication and write origins", async () => {
			const bearerRead = await request.get(`${origin}/api/v1/events/${eventId}`, {
				headers: { origin: externalOrigin, authorization: `Bearer ${token}` },
			});
			expect(bearerRead.status()).toBe(200);
			expect(bearerRead.headers()["access-control-allow-origin"]).toBe(externalOrigin);
			const bearerWrite = await request.put(`${origin}/api/v1/events/${eventId}`, {
				headers: { origin, authorization: `Bearer ${token}` },
				data: eventInput,
			});
			expect(bearerWrite.status()).toBe(200);
			for (const authorization of ["Bearer invalid", "Basic bad"]) {
				const rejected = await request.post(`${origin}/api/v1/events`, {
					headers: { origin: externalOrigin, authorization, cookie: owner.cookie },
					data: eventInput,
				});
				expect(rejected.status()).toBe(401);
			}
			const noOrigin = await request.post(`${origin}/api/v1/events`, {
				headers: { cookie: owner.cookie },
				data: eventInput,
			});
			expect(noOrigin.status()).toBe(403);
			expect((await call("/api/v1/events", "POST", eventInput)).response.status()).toBe(401);
			const evilOrigin = await request.post(`${origin}/api/v1/events`, {
				headers: { origin: "http://evil.example", cookie: owner.cookie },
				data: eventInput,
			});
			expect(evilOrigin.status()).toBe(403);
		});

		await test.step("serves occurrence availability and private ownership", async () => {
			const occurrence = await call(
				`/api/v1/events/${eventId}/occurrences`,
				"POST",
				{
					datePrecision: "exact",
					days: [
						{
							date: "2026-09-20",
							timeKind: "timed",
							startMinute: 540,
							endMinute: 900,
						},
					],
				},
				owner.cookie,
			);
			expect(occurrence.response.status()).toBe(201);
			expect((await call(`/api/v1/events/${eventId}/occurrences`, "GET", undefined, owner.cookie)).response.status()).toBe(200);
			expect((await call(`/api/v1/events/${eventId}/occurrences/${occurrence.data.id}`, "GET", undefined, owner.cookie)).response.status()).toBe(200);
			expect((await call(
				`/api/v1/events/${eventId}/occurrences/${occurrence.data.id}`,
				"PUT",
				{
					datePrecision: "exact",
					days: [{ date: "2026-09-20", timeKind: "timed", startMinute: 540, endMinute: 900 }],
				},
				owner.cookie,
			)).response.status()).toBe(200);
			const recurrence = await call(
				`/api/v1/events/${eventId}/recurrences`,
				"POST",
				{ mode: "expected", anchorDate: "2026-09-20", intervalMonths: 24 },
				owner.cookie,
			);
			expect(recurrence.response.status()).toBe(201);
			expect(
				(await call(
					`/api/v1/events/${eventId}/recurrences/${recurrence.data.id}`,
					"PATCH",
					{ untilDate: "2030-09-20" },
					owner.cookie,
				)).response.status(),
			).toBe(200);
			const query = "latitude=40&longitude=-75&radiusMeters=1000&limit=100";
			const open = await call(`/api/v1/availability?at=2026-09-20T14:30:00Z&${query}`);
			expect(open.response.status()).toBe(200);
			expect(open.data.items.some((item: { id: string }) => item.id === occurrence.data.id)).toBe(true);
			const closed = await call(`/api/v1/availability?at=2026-09-20T19:00:00Z&${query}`);
			expect(closed.data.items.some((item: { id: string }) => item.id === occurrence.data.id)).toBe(false);
			const privateEvent = await call(
				`/api/v1/events/${eventId}`,
				"PUT",
				{ ...eventInput, visibility: "private" },
				owner.cookie,
			);
			expect(privateEvent.response.status()).toBe(200);
			expect((await call(`/api/v1/events/${eventId}`)).response.status()).toBe(404);
			expect((await call(`/api/v1/events/${eventId}`, "GET", undefined, owner.cookie)).response.status()).toBe(200);
			const other = await signUp();
			expect(
				(await call(`/api/v1/events/${eventId}`, "PUT", eventInput, other.cookie)).response.status(),
			).toBe(404);
			expect((await call(
				`/api/v1/events/${eventId}/occurrences/${occurrence.data.id}`,
				"DELETE",
				undefined,
				owner.cookie,
			)).response.status()).toBe(200);
		});

		await test.step("serves place writes and revokes bearer sessions", async () => {
			const placeInput = {
				name: "HTTP museum",
				visibility: "public",
				timezone: "America/New_York",
				location: eventInput.location,
			};
			const place = await call("/api/v1/places", "POST", placeInput, owner.cookie);
			expect(place.response.status()).toBe(201);
			expect((await call("/api/v1/places")).response.status()).toBe(200);
			expect(
				(await call(`/api/v1/places/${place.data.id}`, "PUT", { ...placeInput, name: "Updated museum" }, owner.cookie)).response.status(),
			).toBe(200);
			expect(
				(await call(
					`/api/v1/places/${place.data.id}/hours`,
					"PUT",
					[{
						validFrom: "2026-01-01",
						weekdays: [{
							weekday: 7,
							state: "open",
							intervals: [{ startMinute: 540, endMinute: 1020 }],
						}],
					}],
					owner.cookie,
				)).response.status(),
			).toBe(200);
			expect(
				(await call(
					`/api/v1/places/${place.data.id}/exceptions`,
					"PUT",
					{ date: "2026-09-20", state: "closed" },
					owner.cookie,
				)).response.status(),
			).toBe(200);
			expect((await call(`/api/v1/places/${place.data.id}`, "GET", undefined, owner.cookie)).response.status()).toBe(200);
			expect((await call(`/api/v1/places/${place.data.id}/exceptions/2026-09-20`, "DELETE", undefined, owner.cookie)).response.status()).toBe(204);
			expect((await call(`/api/v1/events/${eventId}`, "DELETE", undefined, owner.cookie)).response.status()).toBe(204);
			expect((await call(`/api/v1/places/${place.data.id}`, "DELETE", undefined, owner.cookie)).response.status()).toBe(204);
			const signout = await request.post(`${origin}/api/auth/sign-out`, {
				headers: { origin, authorization: `Bearer ${token}` },
				data: {},
			});
			expect(signout.status()).toBe(200);
			const revoked = await request.get(`${origin}/api/v1/events`, {
				headers: { authorization: `Bearer ${token}` },
			});
			expect(revoked.status()).toBe(401);
		});
	} finally {
		await db.$client.end();
	}
});
