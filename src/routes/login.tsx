import { createFileRoute } from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import { AppLink } from "../components/app-shell";
import { PlaceholderPage } from "../components/placeholder-page";

export const Route = createFileRoute("/login")({
	head: () => ({ meta: [{ title: "Sign in · Tardis" }] }),
	component: () => (
		<PlaceholderPage
			eyebrow="Your account"
			title="Welcome back"
			description="Sign-in will live here. Account access is not available yet; public discovery will be open to everyone."
			icon={UserRound}
		>
			<AppLink to="/signup" className="primary-link">
				Create an account
			</AppLink>
			<AppLink to="/">Back to explore</AppLink>
		</PlaceholderPage>
	),
});
