import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Plus } from "lucide-react";
import { AppLink } from "../components/app-shell";
import { PlaceholderPage } from "../components/placeholder-page";

export const Route = createFileRoute("/my-events")({
	head: () => ({ meta: [{ title: "My events · Tardis" }] }),
	component: () => (
		<PlaceholderPage
			eyebrow="For the hosts"
			title="My events"
			description="Your drafts, upcoming events, and past gatherings will have a home here."
			icon={CalendarDays}
		>
			<AppLink to="/signup" className="primary-link">
				<Plus aria-hidden="true" />
				Add event
			</AppLink>
		</PlaceholderPage>
	),
});
