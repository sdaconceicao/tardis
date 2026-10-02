import { expect, test } from "@playwright/test";

test("serves documentation from folder-based API routes", async ({ request }) => {
	const docs = await request.get("/api/docs");
	expect(docs.ok()).toBe(true);
	expect(await docs.text()).toContain("/api/openapi.json");

	const schema = await request.get("/api/openapi.json");
	expect(schema.ok()).toBe(true);
	expect(schema.headers()["content-type"]).toContain("application/json");
	expect((await schema.json()).openapi).toBeTruthy();
});
