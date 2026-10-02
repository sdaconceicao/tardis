import { z } from "zod";
import { operations } from "./operations.server";
import { errorSchema } from "./responses";

function jsonSchema(schema: z.ZodType, io: "input" | "output") {
	const { $schema: _, ...result } = z.toJSONSchema(schema, {
		io,
		target: "draft-2020-12",
	});
	return result;
}
export function openApiDocument() {
	const paths: Record<string, Record<string, unknown>> = {};
	for (const operation of operations) {
		const parameters: unknown[] = [
			...operation.path.matchAll(/\{(\w+)\}/g),
		].map(([, name]) => ({
			name,
			in: "path",
			required: true,
			schema: { type: "string", format: name === "date" ? "date" : "uuid" },
		}));
		if (operation.query) {
			const schema = jsonSchema(operation.query, "input");
			for (const [name, property] of Object.entries(schema.properties ?? {}))
				parameters.push({
					name,
					in: "query",
					required: schema.required?.includes(name) ?? false,
					schema: property,
				});
		}
		const responses: Record<string, unknown> = {};
		responses[operation.status] = {
			description: operation.status === 204 ? "Deleted" : "Success",
			...(operation.response
				? {
						content: {
							"application/json": {
								schema: jsonSchema(operation.response, "output"),
							},
						},
					}
				: {}),
		};
		for (const status of [
			400, 401, 403, 404, 405, 409, 413, 415, 422, 500, 503,
		])
			responses[status] = {
				description: {
					400: "Invalid input",
					401: "Authentication required or invalid bearer token",
					403: "Origin or ownership denied",
					404: "Not found or not visible",
					405: "Method not allowed",
					409: "Conflicting data",
					413: "Body exceeds 1 MB",
					415: "JSON required",
					422: "Search too broad or unsupported recurrence",
					500: "Internal error",
					503: "Authentication unavailable",
				}[status],
				content: {
					"application/json": { schema: jsonSchema(errorSchema, "output") },
				},
			};
		paths[operation.path] ??= {};
		paths[operation.path][operation.method.toLowerCase()] = {
			operationId: operation.operationId,
			summary: operation.summary,
			tags: [operation.path.split("/")[1]],
			parameters,
			responses,
			security:
				operation.method === "GET"
					? [{}, { sessionCookie: [] }, { bearerAuth: [] }]
					: [{ sessionCookie: [] }, { bearerAuth: [] }],
			...(operation.body
				? {
						requestBody: {
							required: true,
							content: {
								"application/json": {
									schema: jsonSchema(operation.body, "input"),
								},
							},
						},
					}
				: {}),
		};
	}
	return {
		openapi: "3.1.0",
		info: {
			title: "Tardis API",
			version: "1.0.0",
			description:
				"Events, places and availability. Cookie-authenticated writes require an allowed Origin header. Bearer authentication uses the signed set-auth-token returned by Better Auth sign-in; it is a revocable session token, not a JWT. Public reads return public records plus the caller's own private records. PUT replaces the documented aggregate fields. Dates and minute windows use the resource timezone; intervals are start-inclusive and end-exclusive. Recurrence untilDate is inclusive. Unknown times and month placeholders are excluded from instant availability. Lists use limit/offset; availability sorts by title, kind and ID before pagination. Refer to the repository API guide for recurrence and scheduling constraints enforced beyond JSON Schema.",
		},
		servers: [{ url: "/api/v1" }],
		paths,
		components: {
			securitySchemes: {
				bearerAuth: {
					type: "http",
					scheme: "bearer",
					description:
						"Signed Better Auth session token from the set-auth-token response header. Authorization takes precedence over cookies.",
				},
				sessionCookie: {
					type: "apiKey",
					in: "cookie",
					name: "better-auth.session_token",
					description:
						"Browser-managed Better Auth cookie; HTTPS uses the __Secure- prefix. Swagger uses the current browser session. Cookie writes require an allowed Origin.",
				},
			},
		},
	};
}
