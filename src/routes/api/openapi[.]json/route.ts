import { createFileRoute } from "@tanstack/react-router";
import { errorResponse } from "../../../http/api.server";
import {
	checkCorsOrigin,
	corsResponse,
	preflight,
} from "../../../http/cors.server";
import { openApiDocument } from "../../../http/openapi.server";

function handle({ request }: { request: Request }) {
	try {
		checkCorsOrigin(request);
		return request.method === "OPTIONS"
			? preflight(request, ["GET"])
			: corsResponse(request, Response.json(openApiDocument()));
	} catch (error) {
		return corsResponse(request, errorResponse(error));
	}
}
export const Route = createFileRoute("/api/openapi.json")({
	server: { handlers: { GET: handle, OPTIONS: handle } },
});
