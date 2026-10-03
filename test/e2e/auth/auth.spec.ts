import { expect, test } from "@playwright/test";

test.describe("account access", () => {
	for (const route of ["/login", "/signup"] as const) {
		test(`keeps the ${route} desktop layout readable`, async ({ page }) => {
		await page.setViewportSize({ width: 1280, height: 900 });
		await page.goto(route);
		await page.waitForLoadState("networkidle");
		const intro = await page.getByRole("heading", { name: "Find your place in the day." }).boundingBox();
		const card = await page.getByRole("region", { name: route === "/login" ? "Welcome back" : "Create account" }).boundingBox();
		expect(intro?.width).toBeGreaterThan(300);
		expect(card?.width).toBeGreaterThan(350);
		expect(card?.x).toBeGreaterThan((intro?.x ?? 0) + (intro?.width ?? 0));
		});
	}

	test("keeps the return destination between sign in and registration", async ({ page }) => {
		await page.goto("/login?next=%2Fsaved");
		await page.waitForLoadState("networkidle");
		await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
		await page.getByRole("link", { name: "Sign up" }).click();
		await expect(page).toHaveURL(/\/signup\?next=%2Fsaved/);
		await expect(page.getByRole("heading", { name: "Create account" })).toBeVisible();
		await page.getByRole("main").getByRole("link", { name: "Sign in" }).click();
		await expect(page).toHaveURL(/\/login\?next=%2Fsaved/);
	});

	test("shows a password mismatch without sending registration", async ({ page }) => {
		let registrations = 0;
		await page.route("**/api/auth/sign-up/email", (route) => {
			registrations += 1;
			return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
		});
		await page.goto("/signup");
		await page.waitForLoadState("networkidle");
		await page.getByRole("textbox", { name: "Name" }).fill("Ada");
		await page.getByRole("textbox", { name: "Email" }).fill("ada@example.com");
		await page.getByLabel(/^Password/).fill("password123");
		await page.getByLabel(/^Confirm password/).fill("different123");
		await page.getByRole("button", { name: "Create account" }).click();
		await expect(page.getByRole("alert")).toHaveText("Passwords do not match.");
		expect(registrations).toBe(0);
	});

	test("shows the verification step after registration", async ({ page }) => {
		await page.route("**/api/auth/sign-up/email", (route) => route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ token: null, user: { id: "test-user", email: "ada@example.com", name: "Ada" } }),
		}));
		await page.route("**/api/auth/send-verification-email", (route) => route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({ status: true }),
		}));
		await page.goto("/signup?next=%2Fsaved");
		await page.waitForLoadState("networkidle");
		await page.getByRole("textbox", { name: "Name" }).fill("Ada");
		await page.getByRole("textbox", { name: "Email" }).fill("ada@example.com");
		await page.getByLabel(/^Password/).fill("password123");
		await page.getByLabel(/^Confirm password/).fill("password123");
		await page.getByRole("button", { name: "Create account" }).click();
		await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
		await expect(page.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", /next=%2Fsaved/);
		await page.getByRole("button", { name: "Resend verification email" }).click();
		await expect(page.getByText("A new verification link is on its way.")).toBeVisible();
	});

	test("supports a narrow screen and keyboard password reveal", async ({ page }) => {
		await page.setViewportSize({ width: 375, height: 812 });
		await page.goto("/login");
		await page.waitForLoadState("networkidle");
		await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Google" })).toBeVisible();
		await expect(page.getByRole("button", { name: "Facebook" })).toBeVisible();
		await page.getByRole("button", { name: "Show password" }).focus();
		await page.keyboard.press("Enter");
		await expect(page.getByRole("button", { name: "Hide password" })).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
	});

	test("starts Google and Facebook sign in with the saved return path", async ({ page }) => {
		const requests: Array<{ provider: string; callbackURL: string }> = [];
		await page.route("**/api/auth/sign-in/social", (route) => {
			requests.push(route.request().postDataJSON());
			return route.fulfill({
				status: 400,
				contentType: "application/json",
				body: JSON.stringify({ code: "OAUTH_UNAVAILABLE", message: "Social login unavailable" }),
			});
		});
		await page.goto("/login?next=%2Fsaved");
		await page.waitForLoadState("networkidle");
		await page.getByRole("button", { name: "Google" }).click();
		await expect(page.getByRole("alert")).toContainText("Social login unavailable");
		await page.getByRole("button", { name: "Facebook" }).click();
		await expect.poll(() => requests.length).toBe(2);
		expect(requests).toEqual([
			{ provider: "google", callbackURL: "/saved", errorCallbackURL: "/login" },
			{ provider: "facebook", callbackURL: "/saved", errorCallbackURL: "/login" },
		]);
	});
});
