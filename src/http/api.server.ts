import { z } from "zod";
import { allowedOrigins } from "../config/api.server";
import { type Database, getDatabase } from "../db/client.server";
import {
	type Actor,
	getActor,
	requireActor,
} from "../modules/identity/index.server";
import { DomainError } from "../shared/errors";
import { checkCorsOrigin, corsResponse } from "./cors.server";

export async function readJson<T extends z.ZodType>(
	request: Request,
	schema: T,
): Promise<z.infer<T>> {
	if (
		!request.headers.get("content-type")?.split(";")[0].trim().endsWith("/json")
	)
		throw new DomainError(415, "Send application/json");
	const reader = request.body?.getReader();
	if (!reader) throw new DomainError(400, "A JSON body is required");
	const chunks: Uint8Array[] = [];
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.byteLength;
		if (size > 1024 * 1024) {
			await reader.cancel();
			throw new DomainError(413, "Request body exceeds 1 MB");
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.length;
	}
	let input: unknown;
	try {
		input = JSON.parse(new TextDecoder().decode(bytes));
	} catch {
		throw new DomainError(400, "Invalid JSON");
	}
	return schema.parse(input);
}
export function query<T extends z.ZodType>(
	request: Request,
	schema: T,
): z.infer<T> {
	return schema.parse(Object.fromEntries(new URL(request.url).searchParams));
}
export function checkWriteOrigin(request: Request) {
	const origin = request.headers.get("origin");
	if (!origin || !allowedOrigins().includes(origin))
		throw new DomainError(403, "An allowed Origin header is required");
}
export function errorResponse(error: unknown) {
	const headers = { "Cache-Control": "private, no-store" };
	if (error instanceof DomainError)
		return Response.json(
			{ error: error.message },
			{ status: error.status, headers },
		);
	if (error instanceof z.ZodError)
		return Response.json(
			{
				error: "Invalid input",
				issues: error.issues.map((i) => ({ path: i.path, message: i.message })),
			},
			{ status: 400, headers },
		);
	const cause =
		error && typeof error === "object" && "cause" in error
			? error.cause
			: error;
	const code =
		cause && typeof cause === "object" && "code" in cause
			? cause.code
			: undefined;
	if (["23503", "23505", "23P01", "40001", "40P01"].includes(String(code)))
		return Response.json(
			{ error: "The change conflicts with existing data; refresh and retry" },
			{ status: 409, headers },
		);
	if (code === "23514" || code === "22023")
		return Response.json(
			{ error: "The change violates a schedule or visibility constraint" },
			{ status: 400, headers },
		);
	console.error("API request failed", error);
	return Response.json(
		{ error: "Internal server error" },
		{ status: 500, headers },
	);
}
export async function api<W extends boolean>(
	request: Request,
	write: W,
	handler: (
		db: Database,
		actor: W extends true ? Actor : Actor | null,
	) => Promise<unknown>,
	status = 200,
) {
	try {
		checkCorsOrigin(request);
		const actor = write ? await requireActor(request) : await getActor(request);
		if (write && !request.headers.has("authorization"))
			checkWriteOrigin(request);
		const result = await handler(
			getDatabase(),
			actor as W extends true ? Actor : Actor | null,
		);
		return corsResponse(
			request,
			status === 204
				? new Response(null, {
						status,
						headers: { "Cache-Control": "private, no-store" },
					})
				: Response.json(result, {
						status,
						headers: { "Cache-Control": "private, no-store" },
					}),
		);
	} catch (error) {
		return corsResponse(request, errorResponse(error));
	}
}
