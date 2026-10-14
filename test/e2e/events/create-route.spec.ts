import { expect, test } from "@playwright/test";

test("event creation and event list render at their own URLs", async ({ page }) => {
	await page.route("**/api/auth/get-session", (route) =>
		route.fulfill({ status: 200, contentType: "application/json", body: "null" }),
	);
	await page.goto("/my-events/new");
	await expect(page.getByRole("heading", { name: "Create Event" })).toBeVisible();
	await page.goto("/my-events");
	await expect(page.getByRole("heading", { name: "My events" })).toBeVisible();
});

test("signed-in users see the event form", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.route("**/api/auth/get-session", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				session: { id: "session", userId: "user", expiresAt: "2099-01-01T00:00:00.000Z" },
				user: { id: "user", name: "Host", email: "host@example.test", emailVerified: true },
			}),
		}),
	);
	await page.goto("/my-events/new");
	await expect(page.getByRole("textbox", { name: "Event name" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Add Event" })).toBeVisible();
	const details = await page.getByRole("region", { name: "Event details" }).boundingBox();
	const location = await page.getByRole("region", { name: "Location" }).boundingBox();
	const days = await page.getByRole("region", { name: "Dates and hours" }).boundingBox();
	const repeat = await page.getByRole("region", { name: "Repeat" }).boundingBox();
	expect(details).not.toBeNull();
	expect(location).not.toBeNull();
	expect(days).not.toBeNull();
	expect(repeat).not.toBeNull();
	expect(details!.x).toBeLessThan(days!.x);
	expect(location!.x).toBe(details!.x);
	expect(repeat!.x).toBe(days!.x);
	await page.setViewportSize({ width: 800, height: 900 });
	const stackedLocation = await page.getByRole("region", { name: "Location" }).boundingBox();
	const stackedDays = await page.getByRole("region", { name: "Dates and hours" }).boundingBox();
	expect(stackedLocation).not.toBeNull();
	expect(stackedDays).not.toBeNull();
	expect(stackedDays!.y).toBeGreaterThan(stackedLocation!.y + stackedLocation!.height);
});

test("submitting a one-time event completes the creation flow", async ({ page }) => {
	await page.route("**/api/auth/get-session", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				session: { id: "session", userId: "user", expiresAt: "2099-01-01T00:00:00.000Z" },
				user: { id: "user", name: "Host", email: "host@example.test", emailVerified: true },
			}),
		}),
	);
	await page.route("**/api/v1/discovery/search?*", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify([{
				id: "11111111-1111-4111-8111-111111111111", name: "Town square", address: "Main Street",
				latitude: 40, longitude: -75, timezone: "America/New_York",
			}]),
		}),
	);
	let eventCreated = false;
	let visibility: string | undefined;
	let occurrenceCreated = false;
	await page.route("**/api/v1/events", (route) => {
		eventCreated = true;
		visibility = route.request().postDataJSON().visibility;
		return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "22222222-2222-4222-8222-222222222222" }) });
	});
	await page.route("**/api/v1/events/22222222-2222-4222-8222-222222222222/occurrences", (route) => {
		occurrenceCreated = true;
		return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "33333333-3333-4333-8333-333333333333" }) });
	});
	await page.goto("/my-events/new");
	await page.getByRole("textbox", { name: "Event name" }).fill("Autumn Craft Fair");
	await expect(page.getByRole("radio", { name: "Private" })).toBeChecked();
	await page.getByRole("radio", { name: "Public" }).press("Space");
	await page.getByRole("searchbox", { name: "Search Places" }).fill("Town square");
	await page.getByRole("option", { name: /Town square/ }).click();
	await page.getByRole("spinbutton", { name: /month, Date/ }).fill("11");
	await page.getByRole("spinbutton", { name: /day, Date/ }).fill("15");
	await page.getByRole("spinbutton", { name: /year, Date/ }).fill("2026");
	await page.getByRole("button", { name: "Add Event" }).click();
	await expect(page.getByText("“Autumn Craft Fair” was added.")).toBeVisible();
	expect(eventCreated).toBe(true);
	expect(visibility).toBe("public");
	expect(occurrenceCreated).toBe(true);
});

test("a confirmed address creates a standalone event location", async ({ page }) => {
	await page.route("**/api/auth/get-session", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				session: { id: "session", userId: "user", expiresAt: "2099-01-01T00:00:00.000Z" },
				user: { id: "user", name: "Host", email: "host@example.test", emailVerified: true },
			}),
		}),
	);
	await page.route("**/api/v1/addresses/search?*", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify([{
				id: "address:1",
				label: "12 Main Street, Philadelphia, PA, USA",
				address: {
					line1: "12 Main Street", line2: "", city: "Philadelphia",
					region: "Pennsylvania", postalCode: "19106", country: "United States",
				},
				latitude: 39.95, longitude: -75.15, timezone: "America/New_York",
			}]),
		}),
	);
	let eventInput: Record<string, unknown> | undefined;
	await page.route("**/api/v1/events", (route) => {
		eventInput = route.request().postDataJSON();
		return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "22222222-2222-4222-8222-222222222222" }) });
	});
	await page.route("**/api/v1/events/22222222-2222-4222-8222-222222222222/occurrences", (route) =>
		route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "33333333-3333-4333-8333-333333333333" }) }),
	);
	await page.goto("/my-events/new");
	await page.getByRole("textbox", { name: "Event name" }).fill("Autumn Craft Fair");
	await page.getByRole("textbox", { name: "Location name" }).fill("Community hall");
	await page.getByRole("textbox", { name: "Address line 1" }).fill("12 Main Street");
	await page.getByRole("textbox", { name: "City" }).fill("Philadelphia");
	await page.getByRole("textbox", { name: "State or region" }).fill("Pennsylvania");
	await page.getByRole("textbox", { name: "Country" }).fill("United States");
	await page.getByRole("button", { name: "Find Address" }).click();
	await page.getByRole("option", { name: /12 Main Street, Philadelphia/ }).click();
	await page.getByRole("spinbutton", { name: /month, Date/ }).fill("11");
	await page.getByRole("spinbutton", { name: /day, Date/ }).fill("15");
	await page.getByRole("spinbutton", { name: /year, Date/ }).fill("2026");
	await page.getByRole("button", { name: "Add Event" }).click();
	await expect(page.getByText("“Autumn Craft Fair” was added.")).toBeVisible();
	expect(eventInput).toMatchObject({
		location: {
			label: "Community hall",
			latitude: 39.95,
			longitude: -75.15,
			address: "12 Main Street, Philadelphia, Pennsylvania, 19106, United States",
		},
		timezone: "America/New_York",
	});
});
