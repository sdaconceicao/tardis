import { createFileRoute } from "@tanstack/react-router";
import { UserRoundPlus } from "lucide-react";
import { AppLink } from "../components/app-shell";
import { PlaceholderPage } from "../components/placeholder-page";

export const Route = createFileRoute("/signup")({
	head: () => ({ meta: [{ title: "Create an account · Tardis" }] }),
	component: () => (
		<PlaceholderPage
			eyebrow="Share something worth going to"
			title="Sign up to add an event"
			description="You’ll need an account to share an event. Registration and event creation are coming soon."
			icon={UserRoundPlus}
		>
			<AppLink to="/login" className="primary-link">
				Sign in instead
			</AppLink>
			<AppLink to="/">Back to explore</AppLink>
		</PlaceholderPage>
	),
});
