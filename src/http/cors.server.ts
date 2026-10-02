import { allowedOrigins } from "../config/api.server";
import { DomainError } from "../shared/errors";

export function checkCorsOrigin(request: Request) {
	const origin = request.headers.get("origin");
	if (origin && !allowedOrigins().includes(origin))
		throw new DomainError(403, "Origin is not allowed");
}
export function corsResponse(request: Request, response: Response) {
	response.headers.append("Vary", "Origin");
	const origin = request.headers.get("origin");
	if (origin && allowedOrigins().includes(origin)) {
		response.headers.set("Access-Control-Allow-Origin", origin);
		response.headers.set("Access-Control-Allow-Credentials", "true");
		response.headers.set("Access-Control-Expose-Headers", "set-auth-token");
	}
	return response;
}
export function preflight(request: Request, methods: string[]) {
	checkCorsOrigin(request);
	const method = request.headers.get("access-control-request-method");
	if (method && !methods.includes(method))
		throw new DomainError(405, "Method not allowed");
	const requested = (
		request.headers.get("access-control-request-headers") ?? ""
	)
		.toLowerCase()
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	if (
		requested.some((name) => !["authorization", "content-type"].includes(name))
	)
		throw new DomainError(403, "Request header is not allowed");
	return corsResponse(
		request,
		new Response(null, {
			status: 204,
			headers: {
				Allow: [...methods, "OPTIONS"].join(", "),
				"Access-Control-Allow-Methods": [...methods, "OPTIONS"].join(", "),
				"Access-Control-Allow-Headers": "Authorization, Content-Type",
				"Cache-Control": "private, no-store",
				Vary: "Access-Control-Request-Method, Access-Control-Request-Headers",
			},
		}),
	);
}
