import { expect, test } from "@playwright/test";

const signedInUser = {
	id: "avatar-test-user",
	name: "Ada Lovelace",
	email: "ada@example.com",
	emailVerified: true,
	image: "https://example.com/ada.png",
	createdAt: new Date("2026-01-01T00:00:00Z").toISOString(),
	updatedAt: new Date("2026-01-01T00:00:00Z").toISOString(),
};

for (const image of [signedInUser.image, null]) {
	test(`shows ${image ? "the image" : "initials"} for a signed-in user`, async ({ page }) => {
		if (image) {
			await page.route(image, (route) =>
				route.fulfill({
					status: 200,
					contentType: "image/svg+xml",
					body: '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"/>',
				}),
			);
		}
		await page.route("**/api/auth/get-session*", (route) =>
			route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					user: { ...signedInUser, image },
					session: {
						id: "avatar-test-session",
						userId: signedInUser.id,
						token: "avatar-test-token",
						expiresAt: new Date("2027-01-01T00:00:00Z").toISOString(),
						createdAt: signedInUser.createdAt,
						updatedAt: signedInUser.updatedAt,
					},
				}),
			}),
		);
		await page.goto("/");
		const account = page.getByRole("button", { name: "Open account menu for Ada Lovelace" });
		await expect(account).toBeVisible();
		if (image) {
			await expect(account.getByRole("img", { name: "Ada Lovelace" })).toHaveAttribute("src", image);
		} else {
			await expect(account.getByRole("img", { name: "Ada Lovelace" })).toContainText("AL");
		}
		await account.click();
		await expect(page.getByRole("dialog", { name: "Your account" })).toBeVisible();
		await expect.poll(() => page.getByRole("heading", { name: "Your account" }).evaluate((heading) => heading.getBoundingClientRect().top)).toBeLessThan(90);
		await expect(page.getByText("ada@example.com")).toBeVisible();
		await expect(page.getByRole("link", { name: "Account" })).toHaveAttribute("href", "/account");
		await page.getByRole("heading", { name: "Your account" }).click();
		await expect(page.getByRole("dialog", { name: "Your account" })).toBeVisible();
		await page.mouse.click(20, 20);
		await expect(page.getByRole("dialog", { name: "Your account" })).toBeHidden();
		await account.click();
		await page.getByRole("link", { name: "Account" }).click();
		await expect(page).toHaveURL(/\/account$/);
		await expect(page.getByRole("heading", { name: "Account", exact: true })).toBeVisible();
		await expect(page.getByRole("dialog", { name: "Your account" })).toBeHidden();
	});
}

test("logs out from the account sheet", async ({ page }) => {
	let signedIn = true;
	await page.route("**/api/auth/get-session*", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify(signedIn ? {
				user: { ...signedInUser, image: null },
				session: {
					id: "avatar-test-session",
					userId: signedInUser.id,
					token: "avatar-test-token",
					expiresAt: new Date("2027-01-01T00:00:00Z").toISOString(),
					createdAt: signedInUser.createdAt,
					updatedAt: signedInUser.updatedAt,
				},
			} : null),
		}),
	);
	await page.route("**/api/auth/sign-out", (route) => {
		signedIn = false;
		return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
	});
	await page.goto("/");
	await page.getByRole("button", { name: "Open account menu for Ada Lovelace" }).click();
	await page.getByRole("button", { name: "Logout" }).click();
	await expect(page).toHaveURL(/\/login$/);
	await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});
