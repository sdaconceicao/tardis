import { createFileRoute } from "@tanstack/react-router";
import { AccountPage } from "./-components/AccountPage/AccountPage";

export const Route = createFileRoute("/account/")({
	head: () => ({ meta: [{ title: "Account · Tardis" }] }),
	component: AccountPage,
});
