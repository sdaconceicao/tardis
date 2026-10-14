import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { handler } = vi.hoisted(() => ({ handler: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
	createFileRoute: () => (configuration: unknown) => configuration,
}));
vi.mock("../../../../modules/identity/index.server", () => ({
	getAuth: () => ({ handler }),
}));

import { Route } from "./route";

const handlers = (
	Route as unknown as {
		server: {
			handlers: Record<
				string,
				(context: { request: Request }) => Promise<Response>
			>;
		};
	}
).server.handlers;

beforeEach(() => {
	vi.stubEnv("BETTER_AUTH_URL", "https://app.test");
	handler.mockResolvedValue(Response.json({ ok: true }));
});
afterEach(() => {
	vi.unstubAllEnvs();
	vi.clearAllMocks();
});

describe("authentication API route", () => {
	it("forwards a bearer request without its browser cookie", async () => {
		const request = new Request("https://app.test/api/auth/get-session", {
			headers: {
				origin: "https://app.test",
				authorization: "Bearer token",
				cookie: "session=browser",
			},
		});
		const response = await handlers.GET({ request });
		const forwarded = handler.mock.calls[0][0] as Request;
		expect(forwarded.headers.get("authorization")).toBe("Bearer token");
		expect(forwarded.headers.has("cookie")).toBe(false);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
			"https://app.test",
		);
	});

	it("rejects disallowed origins before invoking authentication", async () => {
		const response = await handlers.GET({
			request: new Request("https://app.test/api/auth/get-session", {
				headers: { origin: "https://evil.test" },
			}),
		});
		expect(response.status).toBe(403);
		expect(handler).not.toHaveBeenCalled();
	});

	it("responds to CORS preflight without invoking authentication", async () => {
		const response = await handlers.OPTIONS({
			request: new Request("https://app.test/api/auth/sign-in", {
				method: "OPTIONS",
				headers: {
					origin: "https://app.test",
					"access-control-request-method": "POST",
				},
			}),
		});
		expect(response.status).toBe(204);
		expect(response.headers.get("Allow")).toBe("GET, POST, OPTIONS");
		expect(handler).not.toHaveBeenCalled();
	});
});
