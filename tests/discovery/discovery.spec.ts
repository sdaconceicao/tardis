import { expect, test } from "@playwright/test";

test("keeps discovery navigation and calendar views usable", async ({ page }) => {
	await page.goto("/");
	await expect(page.getByRole("heading", { name: "Somewhere worth going" })).toBeVisible();
	await expect(page.getByRole("complementary", { name: "Events and places" })).toBeVisible();

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
	await expect(page.getByRole("complementary", { name: "Events and places" })).toBeVisible();
});
