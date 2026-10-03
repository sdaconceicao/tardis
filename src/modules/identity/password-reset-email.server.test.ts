import { describe, expect, it, vi } from "vitest";
import { sendPasswordResetEmail } from "./password-reset-email.server";

describe("sendPasswordResetEmail", () => {
	it("sends the one-time reset link through Resend", async () => {
		const fetcher = vi.fn(async () => new Response(null, { status: 200 }));
		await sendPasswordResetEmail(
			{ apiKey: "resend-test-key", from: "Tardis <hello@example.com>" },
			"traveler@example.com",
			"https://tardis.example/api/auth/reset-password/token?callbackURL=%2Freset-password",
			fetcher,
		);
		const [endpoint, options] = fetcher.mock.calls[0] as unknown as [
			string,
			RequestInit,
		];
		expect(endpoint).toBe("https://api.resend.com/emails");
		expect(options.headers).toMatchObject({
			Authorization: "Bearer resend-test-key",
		});
		expect(JSON.parse(options.body as string)).toMatchObject({
			to: ["traveler@example.com"],
			subject: "Reset your Tardis password",
			text: expect.stringContaining(
				"https://tardis.example/api/auth/reset-password/token",
			),
		});
	});

	it("surfaces delivery failures", async () => {
		await expect(
			sendPasswordResetEmail(
				{ apiKey: "test", from: "hello@example.com" },
				"traveler@example.com",
				"https://tardis.example/reset",
				async () => new Response(null, { status: 422 }),
			),
		).rejects.toThrow("Resend rejected password reset email (422)");
	});
});
