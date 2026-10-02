import { createFileRoute } from "@tanstack/react-router";
import { SignupPage } from "./-components/SignupPage/SignupPage";

export const Route = createFileRoute("/signup")({
	head: () => ({ meta: [{ title: "Create an account · Tardis" }] }),
	component: SignupPage,
});
