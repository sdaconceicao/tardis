import { createFileRoute } from "@tanstack/react-router";
import { ForgotPasswordPage } from "./-components/ForgotPasswordPage/ForgotPasswordPage";

export const Route = createFileRoute("/forgot-password")({
	head: () => ({ meta: [{ title: "Reset your password · Tardis" }] }),
	component: ForgotPasswordPage,
});
