import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = process.env.TEST_API_URL;
if (!base || !["localhost", "127.0.0.1"].includes(new URL(base).hostname))
	throw new Error("TEST_API_URL must point to a disposable local server");
let cookie = "";
let token = "";
const versioned = (path) =>
	path.startsWith("/api/auth/") ? path : path.replace(/^\/api\//, "/api/v1/");
async function call(path, method = "GET", body, authenticated = true) {
	const response = await fetch(`${base}${versioned(path)}`, {
		method,
		headers: {
			origin: base,
			...(body === undefined ? {} : { "content-type": "application/json" }),
			...(authenticated ? { cookie } : {}),
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const data = response.status === 204 ? null : await response.json();
	return { response, data };
}
const email = `${randomUUID()}@example.test`;
const signup = await call("/api/auth/sign-up/email", "POST", {
	name: "HTTP smoke",
	email,
	password: "http-test-password-123!",
});
assert.equal(signup.response.status, 200, JSON.stringify(signup.data));
cookie = signup.response.headers
	.getSetCookie()
	.map((c) => c.split(";")[0])
	.join("; ");
assert.ok(cookie.includes("session_token"));
token = signup.response.headers.get("set-auth-token");
assert.ok(token);
const externalOrigin = "http://localhost:4321";
const login = await fetch(`${base}/api/auth/sign-in/email`, {
	method: "POST",
	headers: { origin: externalOrigin, "content-type": "application/json" },
	body: JSON.stringify({ email, password: "http-test-password-123!" }),
});
assert.equal(login.status, 200);
assert.ok(login.headers.get("set-auth-token"));
assert.equal(login.headers.get("access-control-allow-origin"), externalOrigin);
assert.ok(
	login.headers.get("access-control-expose-headers").includes("set-auth-token"),
);
const unsigned = await fetch(`${base}/api/v1/events`, {
	headers: { Authorization: `Bearer ${signup.data.token}` },
});
assert.equal(unsigned.status, 401);

const preflight = await fetch(`${base}/api/v1/events`, {
	method: "OPTIONS",
	headers: {
		origin: externalOrigin,
		"Access-Control-Request-Method": "POST",
		"Access-Control-Request-Headers": "authorization, content-type",
	},
});
assert.equal(preflight.status, 204);
assert.equal(
	preflight.headers.get("access-control-allow-origin"),
	externalOrigin,
);
const authPreflight = await fetch(`${base}/api/auth/sign-in/email`, {
	method: "OPTIONS",
	headers: {
		origin: externalOrigin,
		"Access-Control-Request-Method": "POST",
		"Access-Control-Request-Headers": "content-type",
	},
});
assert.equal(authPreflight.status, 204);
const deniedPreflight = await fetch(`${base}/api/v1/events`, {
	method: "OPTIONS",
	headers: {
		origin: "http://evil.example",
		"Access-Control-Request-Method": "POST",
	},
});
assert.equal(deniedPreflight.status, 403);
assert.equal(deniedPreflight.headers.get("access-control-allow-origin"), null);
assert.equal(
	(await fetch(`${base}/api/v1/events`, { method: "PATCH" })).status,
	405,
);
assert.equal((await fetch(`${base}/api/v1/missing`)).status, 404);
const spec = await fetch(`${base}/api/openapi.json`);
assert.equal(spec.status, 200);
assert.equal((await spec.json()).openapi, "3.1.0");
const authSpec = await fetch(`${base}/api/auth/open-api/generate-schema`);
assert.equal(authSpec.status, 200);
assert.ok((await authSpec.json()).paths);
const docs = await fetch(`${base}/api/docs`);
assert.equal(docs.status, 200);
const html = await docs.text();
assert.ok(html.includes("SwaggerUIBundle"));
for (const asset of [
	...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g),
].map((m) => m[1])) {
	const res = await fetch(new URL(asset, base));
	assert.equal(res.status, 200, asset);
	assert.ok((await res.text()).length > 1000, asset);
}

const tag = await call("/api/tags", "POST", {
	slug: `smoke-${randomUUID()}`,
	name: "HTTP tag",
});
assert.equal(tag.response.status, 201);
const input = {
	title: "HTTP fair",
	visibility: "public",
	timezone: "America/New_York",
	location: { label: "HTTP location", latitude: 40, longitude: -75 },
	tagIds: [tag.data.id],
};
const event = await call("/api/events", "POST", input);
assert.equal(event.response.status, 201, JSON.stringify(event.data));
const id = event.data.id;
assert.equal(event.data.ownerId, undefined);
assert.equal(
	(await fetch(`${base}/api/events/${id}`)).status,
	200,
	"legacy path",
);
assert.equal((await call("/api/events")).response.status, 200);
assert.equal((await call("/api/tags?q=HTTP")).response.status, 200);
const native = await fetch(`${base}/api/v1/events/${id}`, {
	method: "PUT",
	headers: {
		Authorization: `Bearer ${token}`,
		"content-type": "application/json",
	},
	body: JSON.stringify(input),
});
assert.equal(native.status, 200, await native.text());
const external = await fetch(`${base}/api/v1/events/${id}`, {
	headers: { origin: externalOrigin, Authorization: `Bearer ${token}` },
});
assert.equal(external.status, 200);
assert.equal(
	external.headers.get("access-control-allow-origin"),
	externalOrigin,
);
for (const authorization of ["Bearer invalid", "Basic bad"]) {
	const res = await fetch(`${base}/api/v1/events`, {
		method: "POST",
		headers: {
			origin: externalOrigin,
			authorization,
			cookie,
			"content-type": "application/json",
		},
		body: JSON.stringify(input),
	});
	assert.equal(res.status, 401);
	assert.equal(res.headers.get("access-control-allow-origin"), externalOrigin);
}
const noOrigin = await fetch(`${base}/api/v1/events`, {
	method: "POST",
	headers: { cookie, "content-type": "application/json" },
	body: JSON.stringify(input),
});
assert.equal(noOrigin.status, 403);

const occurrence = await call(`/api/events/${id}/occurrences`, "POST", {
	datePrecision: "exact",
	days: [
		{ date: "2026-09-20", timeKind: "timed", startMinute: 540, endMinute: 900 },
	],
});
assert.equal(occurrence.response.status, 201, JSON.stringify(occurrence.data));
assert.equal(
	(await call(`/api/events/${id}/occurrences`)).response.status,
	200,
);
assert.equal(
	(await call(`/api/events/${id}/occurrences/${occurrence.data.id}`)).response
		.status,
	200,
);
assert.equal(
	(
		await call(`/api/events/${id}/occurrences/${occurrence.data.id}`, "PUT", {
			datePrecision: "exact",
			days: [
				{
					date: "2026-09-20",
					timeKind: "timed",
					startMinute: 540,
					endMinute: 900,
				},
			],
		})
	).response.status,
	200,
);
const rule = await call(`/api/events/${id}/recurrences`, "POST", {
	mode: "expected",
	anchorDate: "2026-09-20",
	intervalMonths: 24,
});
assert.equal(rule.response.status, 201, JSON.stringify(rule.data));
assert.equal(
	(
		await call(`/api/events/${id}/recurrences/${rule.data.id}`, "PATCH", {
			untilDate: "2030-09-20",
		})
	).response.status,
	200,
);
const query = "latitude=40&longitude=-75&radiusMeters=1000&limit=100";
const available = await call(
	`/api/availability?at=2026-09-20T14:30:00Z&${query}`,
);
assert.equal(available.response.status, 200, JSON.stringify(available.data));
assert.ok(available.data.items.some((i) => i.id === occurrence.data.id));
const closed = await call(`/api/availability?at=2026-09-20T19:00:00Z&${query}`);
assert.ok(!closed.data.items.some((i) => i.id === occurrence.data.id));
const privateEvent = await call(`/api/events/${id}`, "PUT", {
	...input,
	visibility: "private",
});
assert.equal(privateEvent.response.status, 200);
assert.equal(
	(await call(`/api/events/${id}`, "GET", undefined, false)).response.status,
	404,
);
assert.equal((await call(`/api/events/${id}`, "GET")).response.status, 200);
assert.equal(
	(await call("/api/events", "POST", input, false)).response.status,
	401,
);
const other = await call("/api/auth/sign-up/email", "POST", {
	name: "Other",
	email: `${randomUUID()}@example.test`,
	password: "http-test-password-123!",
});
const ownerCookie = cookie;
cookie = other.response.headers
	.getSetCookie()
	.map((c) => c.split(";")[0])
	.join("; ");
assert.equal(
	(await call(`/api/events/${id}`, "PUT", input)).response.status,
	404,
);
cookie = ownerCookie;
const rejected = await fetch(`${base}/api/events`, {
	method: "POST",
	headers: {
		origin: "http://evil.example",
		cookie,
		"content-type": "application/json",
	},
	body: JSON.stringify(input),
});
assert.equal(rejected.status, 403);
const place = await call("/api/places", "POST", {
	name: "HTTP museum",
	visibility: "public",
	timezone: "America/New_York",
	location: input.location,
});
assert.equal(place.response.status, 201, JSON.stringify(place.data));
assert.equal((await call("/api/places")).response.status, 200);
assert.equal(
	(
		await call(`/api/places/${place.data.id}`, "PUT", {
			name: "Updated museum",
			visibility: "public",
			timezone: "America/New_York",
			location: input.location,
		})
	).response.status,
	200,
);
assert.equal(
	(
		await call(`/api/places/${place.data.id}/hours`, "PUT", [
			{
				validFrom: "2026-01-01",
				weekdays: [
					{
						weekday: 7,
						state: "open",
						intervals: [{ startMinute: 540, endMinute: 1020 }],
					},
				],
			},
		])
	).response.status,
	200,
);
assert.equal(
	(
		await call(`/api/places/${place.data.id}/exceptions`, "PUT", {
			date: "2026-09-20",
			state: "closed",
		})
	).response.status,
	200,
);
assert.equal((await call(`/api/places/${place.data.id}`)).response.status, 200);
assert.equal(
	(await call(`/api/places/${place.data.id}/exceptions/2026-09-20`, "DELETE"))
		.response.status,
	204,
);
assert.equal(
	(await call(`/api/events/${id}/occurrences/${occurrence.data.id}`, "DELETE"))
		.response.status,
	200,
);
assert.equal((await call(`/api/events/${id}`, "DELETE")).response.status, 204);
assert.equal(
	(await call(`/api/places/${place.data.id}`, "DELETE")).response.status,
	204,
);
const signout = await fetch(`${base}/api/auth/sign-out`, {
	method: "POST",
	headers: {
		Authorization: `Bearer ${token}`,
		"content-type": "application/json",
	},
	body: "{}",
});
assert.equal(signout.status, 200, await signout.text());
const revoked = await fetch(`${base}/api/v1/events`, {
	headers: { Authorization: `Bearer ${token}` },
});
assert.equal(revoked.status, 401);
console.log(
	"HTTP smoke passed: v1 response contracts, legacy paths, signed bearer revocation, CORS, preflight, OpenAPI and Swagger assets, auth, tags, event/day CRUD, availability boundaries, private access, ownership, CSRF, place hours and exceptions.",
);
