import { expect, test } from "@playwright/test";

const baseUser = {
	id: "account-test-user",
	name: "Ada Lovelace",
	email: "ada@example.com",
	emailVerified: true,
	image: null as string | null,
	createdAt: "2026-01-01T00:00:00.000Z",
	updatedAt: "2026-01-01T00:00:00.000Z",
};

function mockSession(page: import("@playwright/test").Page, user: typeof baseUser) {
	return page.route("**/api/auth/get-session*", (route) =>
		route.fulfill({
			status: 200,
			contentType: "application/json",
			body: JSON.stringify({
				user,
				session: {
					id: "account-test-session",
					userId: user.id,
					token: "account-test-token",
					expiresAt: "2027-01-01T00:00:00.000Z",
					createdAt: user.createdAt,
					updatedAt: user.updatedAt,
				},
			}),
		}),
	);
}

test("updates the name and avatar from the account page", async ({ page }) => {
	const user = { ...baseUser };
	await mockSession(page, user);
	await page.route("**/api/auth/update-user", async (route) => {
		Object.assign(user, route.request().postDataJSON());
		await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: true }) });
	});
	await page.goto("/account");
	await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
	await expect(page.getByRole("textbox", { name: "Name" })).toBeVisible();
	await page.getByRole("textbox", { name: "Name" }).fill("Grace Hopper");
	await page.getByRole("button", { name: "Save", exact: true }).click();
	await expect(page.getByRole("region", { name: "Profile details" }).getByRole("status")).toHaveText("Profile updated.");
	await expect.poll(() => user.name).toBe("Grace Hopper");

	await page.locator('input[type="file"]').setInputFiles({
		name: "avatar.png",
		mimeType: "image/png",
		buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=", "base64"),
	});
	await expect(page.getByText("Avatar updated.")).toBeVisible();
	await expect.poll(() => user.image?.startsWith("data:image/png;base64,")).toBe(true);
	await page.reload();
	await expect(page.getByRole("textbox", { name: "Name" })).toHaveValue("Grace Hopper");
	await expect(page.getByRole("img", { name: "Grace Hopper" }).first()).toHaveAttribute("src", /^data:image\/png;base64,/);

	const uploader = page.getByRole("region", { name: "Profile picture" });
	await expect(uploader.locator("img")).toHaveCount(1);
	await uploader.getByRole("button", { name: "Remove avatar.jpg" }).click();
	await expect(page.getByText("Avatar removed.")).toBeVisible();
	await expect.poll(() => user.image).toBeNull();
	await expect(uploader.locator("img")).toHaveCount(0);
});

test("changes the password from account settings", async ({ page }) => {
	const user = { ...baseUser };
	await mockSession(page, user);
	let submitted: Record<string, unknown> | null = null;
	await page.route("**/api/auth/change-password", async (route) => {
		submitted = route.request().postDataJSON();
		await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ token: null }) });
	});
	await page.goto("/account");
	await page.getByRole("link", { name: "Change password" }).click();
	await expect(page).toHaveURL(/\/account\/password$/);
	await page.getByLabel("Current password").fill("old-password");
	await page.getByLabel("New password", { exact: true }).fill("new-password");
	await page.getByLabel("Confirm new password").fill("new-password");
	await page.getByRole("button", { name: "Change password" }).click();
	await expect(page.getByText("Password updated. Use it next time you sign in.")).toBeVisible();
	expect(submitted).toEqual({ currentPassword: "old-password", newPassword: "new-password", revokeOtherSessions: true });
});
