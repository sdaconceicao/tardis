import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, openAPI } from "better-auth/plugins";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { allowedOrigins } from "../../config/api.server";
import { getServerEnv } from "../../config/env.server";
import { type Database, getDatabase } from "../../db/client.server";
import { DomainError } from "../../shared/errors";
import type { Actor } from "./contracts";
import * as schema from "./schema";

export function createAuth(
	db: Database,
	config: { baseURL: string; secret: string },
) {
	return betterAuth({
		baseURL: config.baseURL,
		secret: config.secret,
		database: drizzleAdapter(db, { provider: "pg", schema }),
		emailAndPassword: { enabled: true },
		trustedOrigins: allowedOrigins(),
		plugins: [
			bearer({ requireSignature: true }),
			openAPI({ disableDefaultReference: true }),
			tanstackStartCookies(),
		],
	});
}
let auth: ReturnType<typeof createAuth> | undefined;
export function getAuth() {
	const env = getServerEnv();
	if (!env.BETTER_AUTH_URL || !env.BETTER_AUTH_SECRET)
		throw new DomainError(503, "Authentication is not configured");
	auth ??= createAuth(getDatabase(), {
		baseURL: env.BETTER_AUTH_URL,
		secret: env.BETTER_AUTH_SECRET,
	});
	return auth;
}
export async function getActor(request: Request): Promise<Actor | null> {
	const headers = sessionHeaders(request);
	if (!headers.has("cookie") && !headers.has("authorization")) return null;
	const session = await getAuth().api.getSession({ headers });
	if (headers.has("authorization") && !session)
		throw new DomainError(401, "Invalid or expired bearer token");
	return session ? { subject: session.user.id } : null;
}
export async function requireActor(request: Request): Promise<Actor> {
	const actor = await getActor(request);
	if (!actor) throw new DomainError(401, "Sign in to continue");
	return actor;
}

export function sessionHeaders(request: Request) {
	const headers = new Headers(request.headers);
	if (headers.has("authorization")) {
		if (!/^Bearer \S+$/i.test(headers.get("authorization") ?? ""))
			throw new DomainError(401, "A Bearer token is required");
		headers.delete("cookie");
	}
	return headers;
}
