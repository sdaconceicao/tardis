import { describe, expect, it } from "vitest";
import { allowedOrigins } from "./api.server";

describe("allowedOrigins", () => {
	it("normalizes and deduplicates configured origins", () => {
		expect(
			allowedOrigins({
				BETTER_AUTH_URL: "https://app.test/",
				API_ALLOWED_ORIGINS: " https://frontend.test,https://app.test ",
			} as NodeJS.ProcessEnv),
		).toEqual(["https://app.test", "https://frontend.test"]);
	});

	it("rejects URL paths, credentials, queries, and non-HTTP schemes", () => {
		for (const origin of [
			"https://app.test/path",
			"https://user@app.test",
			"https://app.test/?q=1",
			"file:///tmp/app",
		])
			expect(() =>
				allowedOrigins({ BETTER_AUTH_URL: origin } as NodeJS.ProcessEnv),
			).toThrow();
	});

	it("returns an empty allowlist when no origins are configured", () => {
		expect(allowedOrigins({} as NodeJS.ProcessEnv)).toEqual([]);
	});
});
