import { afterEach, describe, expect, it, vi } from "vitest";
import { allowedOrigins } from "../config/api.server";
import { sessionHeaders } from "../modules/identity/auth.server";
import { checkCorsOrigin, corsResponse, preflight } from "./cors.server";

afterEach(() => vi.unstubAllEnvs());
describe("cross-origin and bearer boundaries", () => {
	it("accepts exact origins and rejects wildcards, paths and credentials", () => {
		expect(
			allowedOrigins({
				BETTER_AUTH_URL: "https://api.test",
				API_ALLOWED_ORIGINS: "https://app.test, https://app.test",
			}),
		).toEqual(["https://api.test", "https://app.test"]);
		for (const origin of [
			"*",
			"https://app.test/path",
			"https://user:secret@app.test",
			"null",
		])
			expect(() => allowedOrigins({ API_ALLOWED_ORIGINS: origin })).toThrow();
	});
	it("handles preflight without session or database configuration", () => {
		vi.stubEnv("BETTER_AUTH_URL", "https://api.test");
		vi.stubEnv("API_ALLOWED_ORIGINS", "https://app.test");
		const request = new Request("https://api.test/api/v1/events", {
			method: "OPTIONS",
			headers: {
				Origin: "https://app.test",
				"Access-Control-Request-Method": "POST",
				"Access-Control-Request-Headers": "authorization, content-type",
			},
		});
		const response = preflight(request, ["GET", "POST"]);
		expect(response.status).toBe(204);
		expect(response.headers.get("access-control-allow-origin")).toBe(
			"https://app.test",
		);
		expect(response.headers.get("access-control-allow-credentials")).toBe(
			"true",
		);
		expect(response.headers.get("vary")).toContain("Origin");
		const denied = new Request(request, {
			headers: { Origin: "https://app.test.evil.test" },
		});
		expect(() => checkCorsOrigin(denied)).toThrow();
		expect(
			corsResponse(denied, new Response()).headers.has(
				"access-control-allow-origin",
			),
		).toBe(false);
	});
	it("never falls back to cookies when Authorization is supplied", () => {
		const request = new Request("https://api.test", {
			headers: {
				Cookie: "better-auth.session_token=valid",
				Authorization: "Bearer invalid",
			},
		});
		expect(sessionHeaders(request).has("cookie")).toBe(false);
		expect(() =>
			sessionHeaders(
				new Request(request, { headers: { Authorization: "Basic bad" } }),
			),
		).toThrow();
	});
});
