import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	resendVerificationEmail,
	startSocialSignIn,
} from "./auth-client-actions";

const mocks = vi.hoisted(() => ({
	sendVerificationEmail: vi.fn(),
	social: vi.fn(),
}));
vi.mock("./auth-client", () => ({
	authClient: {
		sendVerificationEmail: mocks.sendVerificationEmail,
		signIn: { social: mocks.social },
	},
}));

beforeEach(() => {
	vi.clearAllMocks();
	mocks.sendVerificationEmail.mockResolvedValue({ data: {} });
	mocks.social.mockResolvedValue({ data: {} });
});

describe("auth client actions", () => {
	it("trims the email and preserves the return destination", async () => {
		await resendVerificationEmail("  ada@example.com  ", "/saved?view=list");
		expect(mocks.sendVerificationEmail).toHaveBeenCalledWith({
			email: "ada@example.com",
			callbackURL: "/login?verified=1&next=%2Fsaved%3Fview%3Dlist",
		});
	});

	it("passes the provider and callback to social sign-in", async () => {
		await startSocialSignIn("google", "/calendar");
		expect(mocks.social).toHaveBeenCalledWith({
			provider: "google",
			callbackURL: "/calendar",
			errorCallbackURL: "/login",
		});
	});

	it("surfaces service errors for both actions", async () => {
		mocks.sendVerificationEmail.mockResolvedValue({
			error: { message: "Email unavailable" },
		});
		mocks.social.mockResolvedValue({
			error: { message: "Provider unavailable" },
		});
		await expect(
			resendVerificationEmail("ada@example.com", "/"),
		).rejects.toThrow("Email unavailable");
		await expect(startSocialSignIn("facebook", "/")).rejects.toThrow(
			"Provider unavailable",
		);
	});
});
