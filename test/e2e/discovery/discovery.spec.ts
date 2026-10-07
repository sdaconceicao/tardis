import { expect, test } from "@playwright/test";

test("keeps discovery navigation and calendar views usable", async ({ page }) => {
	await page.goto("/");
	await expect(page.getByRole("heading", { name: "Somewhere worth going" })).toBeVisible();
	await expect(page.getByRole("complementary", { name: "Places to explore" })).toBeVisible();
	await expect(page.getByRole("combobox", { name: "Category" })).toBeVisible();
	await expect(page.getByRole("region", { name: "Explore map" })).toBeVisible();
	await expect(page.locator("canvas.maplibregl-canvas")).toBeVisible();

	await page.getByRole("navigation", { name: "Discovery view" }).getByRole("link", { name: "Calendar" }).click();
	await expect(page.getByRole("heading", { name: "Your week, wide open." })).toBeVisible();
	await page.getByRole("navigation", { name: "Calendar view" }).getByRole("link", { name: "agenda" }).click();
	await expect(page.getByRole("heading", { name: "Make a little time to explore." })).toBeVisible();
	await expect(page.getByText("Mon", { exact: true })).toHaveCount(0);
});

test("stacks the discovery panel on a narrow screen", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/");
	const layout = page.getByRole("main").locator("div").first();
	await expect(layout).toHaveCSS("flex-direction", "column");
	await expect(page.getByRole("complementary", { name: "Places to explore" })).toBeVisible();
});

test("shows a discovered POI in the map results and selects it", async ({ page }) => {
	await page.route("https://tiles.openfreemap.org/styles/liberty", async (route) => {
		await route.fulfill({ json: { version: 8, sources: {}, layers: [] } });
	});
	await page.route("**/api/v1/discovery/clusters?*", async (route) => {
		await route.fulfill({
			json: {
				clusters: [{
					cellX: 0, cellY: 0, count: 1,
					latitude: 39, longitude: -98,
					west: -98, east: -98, south: 39, north: 39,
				}],
				capped: false,
				approximate: false,
				catalogStatus: "ready",
			},
		});
	});
	await page.route("**/api/v1/discovery?*", async (route) => {
		await route.fulfill({
			json: {
				items: [{
					id: "3c85cd80-adb3-4fee-9350-aeaa7cb826a1",
					name: "National Museum",
					latitude: 39, longitude: -98,
					address: "Main Street",
					category: "museums",
					sourceRelease: "2026-09-23.1",
					source: "Overture Maps",
					hoursState: "unknown",
				}],
				hasMore: false,
				nextCursor: null,
				catalogStatus: "ready",
			},
		});
	});
	await page.goto("/");
	await expect(page.getByRole("status")).toContainText("1 place in this map area");
	await expect(page.getByRole("region", { name: "Explore map" })).toHaveAttribute("aria-busy", "false");
	for (let index = 0; index < 7; index++) {
		await page.getByRole("button", { name: "Zoom in" }).click();
		await page.waitForTimeout(350);
	}
	await page.getByRole("button", { name: "Search this area" }).click();
	const result = page.getByRole("button", { name: /National Museum/ });
	await expect(result).toBeVisible();
	await result.click();
	await expect(result).toHaveAttribute("aria-pressed", "true");
	await expect(page).toHaveURL(/poi=3c85cd80/);
	await page.goBack();
	await expect(result).toHaveAttribute("aria-pressed", "false");
});
