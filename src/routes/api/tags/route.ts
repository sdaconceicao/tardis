import { createFileRoute } from "@tanstack/react-router";
import { handlers } from "../../../http/operations.server";
export const Route = createFileRoute("/api/tags")({ server: { handlers } });
