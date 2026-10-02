import { createFileRoute } from "@tanstack/react-router";
import { errorResponse } from "../../../http/api.server";
import {
	checkCorsOrigin,
	corsResponse,
	preflight,
} from "../../../http/cors.server";
import { sessionHeaders } from "../../../modules/identity/auth.server";
import { getAuth } from "../../../modules/identity/index.server";

async function handle({ request }: { request: Request }) {
	try {
		checkCorsOrigin(request);
		if (request.method === "OPTIONS")
			return preflight(request, ["GET", "POST"]);
		return corsResponse(
			request,
			await getAuth().handler(
				new Request(request.url, {
					method: request.method,
					headers: sessionHeaders(request),
					...(request.method === "POST"
						? { body: request.body, duplex: "half" }
						: {}),
				}),
			),
		);
	} catch (error) {
		return corsResponse(request, errorResponse(error));
	}
}
export const Route = createFileRoute("/api/auth/$")({
	server: { handlers: { GET: handle, POST: handle, OPTIONS: handle } },
});
