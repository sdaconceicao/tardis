import { describe, expect, it } from "vitest";
import { allowedOrigins, resolveAuthBaseUrl } from "./api.server";

describe("resolveAuthBaseUrl", () => {
	it("uses the stable production domain on Vercel", () => {
		expect(
			resolveAuthBaseUrl({
				VERCEL_ENV: "production",
				VERCEL_PROJECT_PRODUCTION_URL: "app.example",
				VERCEL_BRANCH_URL: "branch.example",
			} as NodeJS.ProcessEnv),
		).toBe("https://app.example");
	});

	it("uses the branch alias in previews", () => {
		expect(
			resolveAuthBaseUrl({
				VERCEL_ENV: "preview",
				VERCEL_BRANCH_URL: "branch.example",
				VERCEL_URL: "unique-deployment.example",
			} as NodeJS.ProcessEnv),
		).toBe("https://branch.example");
	});

	it("allows an explicit override and local request inference", () => {
		expect(
			resolveAuthBaseUrl({
				BETTER_AUTH_URL: "http://localhost:3006",
				VERCEL_BRANCH_URL: "branch.example",
			} as NodeJS.ProcessEnv),
		).toBe("http://localhost:3006");
		expect(resolveAuthBaseUrl({} as NodeJS.ProcessEnv)).toBeUndefined();
	});
});

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

	it("allows branch and deployment hosts without per-preview configuration", () => {
		expect(
			allowedOrigins({
				VERCEL_ENV: "preview",
				VERCEL_BRANCH_URL: "branch.example",
				VERCEL_URL: "unique-deployment.example",
			} as NodeJS.ProcessEnv),
		).toEqual(["https://branch.example", "https://unique-deployment.example"]);
	});
});
