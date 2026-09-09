import { describe, expect, it } from "vitest";

import { getServerEnv } from "./env.server";

describe("getServerEnv", () => {
	it("accepts the minimum server configuration", () => {
		expect(
			getServerEnv({
				DATABASE_URL: "postgresql://example.test/tardis",
			}),
		).toMatchObject({
			DATABASE_URL: "postgresql://example.test/tardis",
		});
	});

	it("rejects short auth cookie secrets", () => {
		expect(() =>
			getServerEnv({
				DATABASE_URL: "postgresql://example.test/tardis",
				NEON_AUTH_COOKIE_SECRET: "too-short",
			}),
		).toThrow();
	});
});
