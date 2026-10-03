import { expect, test } from "@playwright/test";

test.describe("password reset", () => {
	test("links from sign in to the reset request page", async ({ page }) => {
		await page.goto("/login?next=%2Fsaved");
		await page.waitForLoadState("networkidle");
		await page.getByRole("link", { name: "Forgot password?" }).click();
		await expect(page).toHaveURL(/\/forgot-password\?next=%2Fsaved/);
	});

	test("requests a link and preserves the return destination", async ({ page }) => {
		const requests: Array<{ email: string; redirectTo: string }> = [];
		await page.route("**/api/auth/request-password-reset", (route) => {
			requests.push(route.request().postDataJSON());
			return route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ status: true }),
			});
		});
		await page.goto("/forgot-password?next=%2Fsaved");
		await page.waitForLoadState("networkidle");
		await page.getByRole("textbox", { name: "Email" }).fill("ada@example.com");
		await page.getByRole("button", { name: "Send reset link" }).click();
		await expect(page.getByRole("status")).toContainText("If an account uses this email");
		expect(requests).toEqual([
			{ email: "ada@example.com", redirectTo: "/reset-password?next=%2Fsaved" },
		]);
		await page.getByRole("button", { name: "Send another link" }).click();
		await expect.poll(() => requests.length).toBe(2);
		await page.getByRole("link", { name: "Back to sign in" }).click();
		await expect(page).toHaveURL(/\/login\?next=%2Fsaved/);
	});

	test("handles an expired link and lets the user request another", async ({ page }) => {
		await page.goto("/reset-password?error=INVALID_TOKEN&next=%2Fsaved");
		await page.waitForLoadState("networkidle");
		await expect(page.getByRole("alert")).toContainText("invalid or expired");
		await expect(page.getByRole("button", { name: "Reset password" })).toHaveCount(0);
		await page.getByRole("link", { name: "Request a new link" }).click();
		await expect(page).toHaveURL(/\/forgot-password\?next=%2Fsaved/);
	});

	test("sets a new password after checking confirmation", async ({ page }) => {
		const requests: Array<{ newPassword: string; token: string }> = [];
		await page.route("**/api/auth/reset-password", (route) => {
			requests.push(route.request().postDataJSON());
			return route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ status: true }),
			});
		});
		await page.goto("/reset-password?token=one-time-token&next=%2Fsaved");
		await page.waitForLoadState("networkidle");
		await page.getByRole("textbox", { name: /^New password/ }).fill("password123");
		await page.getByRole("textbox", { name: /^Confirm new password/ }).fill("different123");
		await page.getByRole("button", { name: "Reset password" }).click();
		await expect(page.getByRole("alert")).toHaveText("Passwords do not match.");
		expect(requests).toHaveLength(0);
		await page.getByRole("textbox", { name: /^Confirm new password/ }).fill("password123");
		await page.getByRole("button", { name: "Reset password" }).click();
		await expect(page.getByRole("heading", { name: "Password updated" })).toBeVisible();
		expect(requests).toEqual([{ newPassword: "password123", token: "one-time-token" }]);
		await page.getByRole("link", { name: "Back to sign in" }).click();
		await expect(page).toHaveURL(/\/login\?next=%2Fsaved/);
	});

	test("keeps both reset pages readable on a narrow screen", async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		for (const path of ["/forgot-password", "/reset-password?token=test-token"]) {
			await page.goto(path);
			await page.waitForLoadState("networkidle");
			await expect(page.getByRole("heading", { name: "Find your place in the day." })).toBeVisible();
			expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
		}
	});
});
