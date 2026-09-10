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

	it("rejects short auth secrets", () => {
		expect(() =>
			getServerEnv({
				DATABASE_URL: "postgresql://example.test/tardis",
				BETTER_AUTH_SECRET: "too-short",
			}),
		).toThrow();
	});
});
