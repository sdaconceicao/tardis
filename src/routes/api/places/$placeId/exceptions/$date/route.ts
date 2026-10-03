import { createFileRoute } from "@tanstack/react-router";
import { handlers } from "../../../../../../http/operations.server";
export const Route = createFileRoute("/api/places/$placeId/exceptions/$date")({
	server: { handlers },
});
