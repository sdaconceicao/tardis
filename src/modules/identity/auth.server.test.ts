import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createAuth,
	getActor,
	getAuth,
	requireActor,
	sessionHeaders,
} from "./auth.server";

const { mocks, environment } = vi.hoisted(() => ({
	mocks: { betterAuth: vi.fn(), getSession: vi.fn() },
	environment: {
		current: {
			BETTER_AUTH_URL: "https://app.test",
			BETTER_AUTH_SECRET: "secret",
			RESEND_API_KEY: "key",
			RESEND_FROM_EMAIL: "hello@app.test",
		} as Record<string, string | undefined>,
	},
}));

vi.mock("better-auth", () => ({ betterAuth: mocks.betterAuth }));
vi.mock("better-auth/adapters/drizzle", () => ({ drizzleAdapter: () => ({}) }));
vi.mock("better-auth/plugins", () => ({
	bearer: () => ({}),
	openAPI: () => ({}),
}));
vi.mock("better-auth/tanstack-start", () => ({
	tanstackStartCookies: () => ({}),
}));
vi.mock("../../config/env.server", () => ({
	getServerEnv: () => environment.current,
}));
vi.mock("../../db/client.server", () => ({ getDatabase: () => ({}) }));

beforeEach(() => {
	vi.clearAllMocks();
	mocks.betterAuth.mockImplementation(() => ({
		api: { getSession: mocks.getSession },
	}));
	environment.current = {
		BETTER_AUTH_URL: "https://app.test",
		BETTER_AUTH_SECRET: "secret",
		RESEND_API_KEY: "key",
		RESEND_FROM_EMAIL: "hello@app.test",
	};
});
afterEach(() => vi.unstubAllEnvs());

describe("session headers", () => {
	it("keeps cookies for browser sessions", async () => {
		const request = new Request("https://app.test", {
			headers: { cookie: "session=abc" },
		});
		expect(sessionHeaders(request).get("cookie")).toBe("session=abc");
	});

	it("prefers a bearer token over a cookie", () => {
		const request = new Request("https://app.test", {
			headers: { cookie: "session=abc", authorization: "Bearer token" },
		});
		const headers = sessionHeaders(request);
		expect(headers.get("authorization")).toBe("Bearer token");
		expect(headers.has("cookie")).toBe(false);
	});

	it("rejects malformed bearer credentials", () => {
		for (const authorization of ["Basic token", "Bearer ", "Bearer two words"])
			expect(() =>
				sessionHeaders(
					new Request("https://app.test", { headers: { authorization } }),
				),
			).toThrow();
	});

	it("does not initialize authentication for anonymous requests", async () => {
		await expect(getActor(new Request("https://app.test"))).resolves.toBeNull();
		expect(mocks.getSession).not.toHaveBeenCalled();
	});

	it("loads the actor from a browser session", async () => {
		mocks.getSession.mockResolvedValue({ user: { id: "ada" } });
		await expect(
			getActor(
				new Request("https://app.test", { headers: { cookie: "session=abc" } }),
			),
		).resolves.toEqual({ subject: "ada" });
		expect(mocks.getSession).toHaveBeenCalledWith({
			headers: expect.any(Headers),
		});
	});

	it("rejects an invalid bearer token instead of treating it as a guest", async () => {
		mocks.getSession.mockResolvedValue(null);
		await expect(
			getActor(
				new Request("https://app.test", {
					headers: { authorization: "Bearer token", cookie: "session=abc" },
				}),
			),
		).rejects.toMatchObject({ status: 401 });
		const headers = mocks.getSession.mock.calls[0][0].headers as Headers;
		expect(headers.has("cookie")).toBe(false);
	});

	it("requires a session when an actor is mandatory", async () => {
		await expect(
			requireActor(new Request("https://app.test")),
		).rejects.toMatchObject({ status: 401 });
	});

	it("fails clearly when auth or verification email is not configured", () => {
		environment.current.BETTER_AUTH_SECRET = undefined;
		expect(() => getAuth()).toThrow(/Authentication is not configured/);
		environment.current.BETTER_AUTH_SECRET = "secret";
		environment.current.RESEND_API_KEY = undefined;
		expect(() => getAuth()).toThrow(/Verification email is not configured/);
	});

	it("uses the preview branch URL when BETTER_AUTH_URL is absent", async () => {
		vi.stubEnv("VERCEL_ENV", "preview");
		vi.stubEnv("VERCEL_BRANCH_URL", "preview.example");
		environment.current.BETTER_AUTH_URL = undefined;
		vi.resetModules();
		const { getAuth: freshGetAuth } = await import("./auth.server");
		freshGetAuth();
		expect(mocks.betterAuth).toHaveBeenCalledWith(
			expect.objectContaining({ baseURL: "https://preview.example" }),
		);
	});

	it("configures verification and optional social providers", () => {
		createAuth({} as never, {
			baseURL: "https://app.test",
			secret: "secret",
			verificationEmail: async () => undefined,
			google: { clientId: "id", clientSecret: "secret" },
		});
		expect(mocks.betterAuth).toHaveBeenCalledWith(
			expect.objectContaining({
				emailAndPassword: expect.objectContaining({
					requireEmailVerification: true,
					revokeSessionsOnPasswordReset: true,
				}),
				socialProviders: { google: { clientId: "id", clientSecret: "secret" } },
			}),
		);
	});
});
