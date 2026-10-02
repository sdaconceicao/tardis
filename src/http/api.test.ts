import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { DomainError } from "../shared/errors";
import { checkWriteOrigin, errorResponse, readJson } from "./api.server";

afterEach(() => vi.unstubAllEnvs());
describe("API boundaries", () => {
	it("rejects cross-origin and missing-origin writes", () => {
		vi.stubEnv("BETTER_AUTH_URL", "https://app.test");
		vi.stubEnv("API_ALLOWED_ORIGINS", "https://frontend.test");
		expect(() =>
			checkWriteOrigin(
				new Request("https://app.test/api/events", {
					headers: { origin: "https://evil.test" },
				}),
			),
		).toThrow();
		expect(() =>
			checkWriteOrigin(new Request("https://app.test/api/events")),
		).toThrow();
	});
	it("rejects malformed JSON, unknown ownership fields, and oversized payloads", async () => {
		const req = (body: string) =>
			new Request("https://app.test/api/events", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body,
			});
		await expect(readJson(req("{"), z.object({}))).rejects.toMatchObject({
			status: 400,
		});
		await expect(
			readJson(req('{"ownerId":"victim"}'), z.strictObject({})),
		).rejects.toThrow();
		await expect(
			readJson(req(JSON.stringify("a".repeat(1024 * 1024))), z.string()),
		).rejects.toMatchObject({ status: 413 });
	});
	it("returns private no-store responses and hides foreign-key details", async () => {
		const response = errorResponse({
			cause: { code: "23503", detail: "private owner secret" },
		});
		expect(response.status).toBe(409);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		expect(await response.text()).not.toContain("secret");
		expect(errorResponse(new DomainError(401, "Sign in")).status).toBe(401);
	});
});
