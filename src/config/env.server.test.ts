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

	it("normalizes empty optional credentials to undefined", () => {
		expect(
			getServerEnv({
				DATABASE_URL: "postgresql://example.test/tardis",
				BETTER_AUTH_URL: "",
				BETTER_AUTH_SECRET: "",
				GOOGLE_CLIENT_ID: "",
				OPENROUTESERVICE_API_KEY: "",
			}),
		).toMatchObject({
			BETTER_AUTH_URL: undefined,
			BETTER_AUTH_SECRET: undefined,
			GOOGLE_CLIENT_ID: undefined,
			OPENROUTESERVICE_API_KEY: undefined,
		});
	});

	it("rejects a missing database URL and malformed auth URL", () => {
		expect(() => getServerEnv({})).toThrow();
		expect(() =>
			getServerEnv({
				DATABASE_URL: "postgresql://example.test/tardis",
				BETTER_AUTH_URL: "not a URL",
			}),
		).toThrow();
	});
});
