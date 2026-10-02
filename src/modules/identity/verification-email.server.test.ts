import { describe, expect, it, vi } from "vitest";
import { sendVerificationEmail } from "./verification-email.server";

describe("sendVerificationEmail", () => {
	it("posts the verification link to Resend with server credentials", async () => {
		const fetcher = vi.fn(async () => new Response(null, { status: 200 }));
		await sendVerificationEmail(
			{ apiKey: "resend-test-key", from: "Tardis <hello@example.com>" },
			"traveler@example.com",
			"https://tardis.example/api/auth/verify-email?token=test",
			fetcher,
		);
		expect(fetcher).toHaveBeenCalledOnce();
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
			text: expect.stringContaining(
				"https://tardis.example/api/auth/verify-email?token=test",
			),
		});
	});

	it("surfaces delivery failures", async () => {
		await expect(
			sendVerificationEmail(
				{ apiKey: "test", from: "hello@example.com" },
				"traveler@example.com",
				"https://tardis.example/verify",
				async () => new Response(null, { status: 422 }),
			),
		).rejects.toThrow("Resend rejected verification email (422)");
	});
});
