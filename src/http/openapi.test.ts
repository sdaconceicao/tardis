import SwaggerParser from "@apidevtools/swagger-parser";
import { describe, expect, it } from "vitest";
import { openApiDocument } from "./openapi.server";
import { operations } from "./operations.server";

describe("OpenAPI contract", () => {
	it("validates and documents every dispatched operation", async () => {
		const document = openApiDocument();
		await expect(
			SwaggerParser.validate(JSON.parse(JSON.stringify(document))),
		).resolves.toBeDefined();
		expect(
			new Set(operations.map((operation) => operation.operationId)).size,
		).toBe(operations.length);
		expect(Object.values(document.paths).flatMap(Object.keys)).toHaveLength(
			operations.length,
		);
		for (const operation of operations)
			expect(
				document.paths[operation.path][operation.method.toLowerCase()],
			).toMatchObject({ operationId: operation.operationId });
	});
	it("documents required instant filters, decimal prices and independent auth alternatives", () => {
		const paths = openApiDocument().paths;
		expect(paths["/availability"].get).toMatchObject({
			parameters: expect.arrayContaining([
				expect.objectContaining({
					name: "at",
					required: true,
					schema: expect.objectContaining({
						type: "string",
						format: "date-time",
					}),
				}),
				expect.objectContaining({
					name: "latitude",
					required: true,
					schema: expect.objectContaining({ type: "number" }),
				}),
			]),
		});
		expect(paths["/events"].post).toMatchObject({
			security: [{ sessionCookie: [] }, { bearerAuth: [] }],
		});
	});
});
