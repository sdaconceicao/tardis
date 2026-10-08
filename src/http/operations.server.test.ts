import { afterEach, describe, expect, it, vi } from "vitest";
import * as places from "../modules/places/index.server";
import { dispatch, operations } from "./operations.server";

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

describe("API dispatch", () => {
	it("returns 404 for unknown endpoints", async () => {
		const response = await dispatch(
			new Request("https://app.test/api/unknown"),
		);
		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "Endpoint not found" });
	});

	it("returns 405 with allowed methods for a known route", async () => {
		const response = await dispatch(
			new Request("https://app.test/api/events", { method: "PATCH" }),
		);
		expect(response.status).toBe(405);
		expect(response.headers.get("Allow")).toBe("GET, POST, OPTIONS");
	});

	it("handles preflight and rejects unsupported methods", async () => {
		vi.stubEnv("BETTER_AUTH_URL", "https://app.test");
		const response = await dispatch(
			new Request("https://app.test/api/events", {
				method: "OPTIONS",
				headers: {
					origin: "https://app.test",
					"access-control-request-method": "POST",
				},
			}),
		);
		expect(response.status).toBe(204);
		expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
			"GET, POST, OPTIONS",
		);
		const denied = await dispatch(
			new Request("https://app.test/api/events", {
				method: "OPTIONS",
				headers: {
					origin: "https://app.test",
					"access-control-request-method": "PATCH",
				},
			}),
		);
		expect(denied.status).toBe(405);
	});

	it("decodes path parameters and recognizes versioned routes", async () => {
		const operation = operations.find(
			(item) => item.operationId === "getEvent",
		);
		if (!operation) throw new Error("getEvent operation missing");
		const original = operation.handle;
		const handle = vi.fn(async () => new Response("ok"));
		operation.handle = handle;
		try {
			const response = await dispatch(
				new Request("https://app.test/api/v1/events/id%2D123/"),
			);
			expect(response.status).toBe(200);
			expect(handle).toHaveBeenCalledWith(
				expect.any(Request),
				{ eventId: "id-123" },
				true,
			);
		} finally {
			operation.handle = original;
		}
	});

	it("serves public clusters with a cookie when auth is not configured", async () => {
		vi.stubEnv("DATABASE_URL", "postgresql://example.test/tardis");
		vi.stubEnv("BETTER_AUTH_URL", "");
		const clusterDiscovery = vi
			.spyOn(places, "clusterDiscovery")
			.mockResolvedValue({
				clusters: [],
				capped: false,
				approximate: false,
				catalogStatus: "empty",
			});
		const response = await dispatch(
			new Request(
				"https://app.test/api/v1/discovery/clusters?west=-90&south=35&east=-70&north=45&zoom=6",
				{ headers: { cookie: "better-auth.session_token=old-session" } },
			),
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			clusters: [],
			capped: false,
			approximate: false,
			catalogStatus: "empty",
		});
		expect(clusterDiscovery).toHaveBeenCalledOnce();
	});
});
