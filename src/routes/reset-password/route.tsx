import { createFileRoute } from "@tanstack/react-router";
import { ResetPasswordPage } from "./-components/ResetPasswordPage/ResetPasswordPage";

export const Route = createFileRoute("/reset-password")({
	head: () => ({ meta: [{ title: "Set a new password · Tardis" }] }),
	component: ResetPasswordPage,
});
