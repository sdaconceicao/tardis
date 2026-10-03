import { createFileRoute } from "@tanstack/react-router";
import { ChangePasswordPage } from "./-components/ChangePasswordPage/ChangePasswordPage";

export const Route = createFileRoute("/account/password")({
	head: () => ({ meta: [{ title: "Change password · Tardis" }] }),
	component: ChangePasswordPage,
});
