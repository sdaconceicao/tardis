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
		const account = page.getByRole("link", { name: "Account: Ada Lovelace" });
		await expect(account).toBeVisible();
		await expect(account).toHaveAttribute("href", "/my-events");
		if (image) {
			await expect(account.getByRole("img", { name: "Ada Lovelace" })).toHaveAttribute("src", image);
		} else {
			await expect(account.getByRole("img", { name: "Ada Lovelace" })).toContainText("AL");
		}
	});
}
