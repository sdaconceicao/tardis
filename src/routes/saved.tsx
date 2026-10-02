import { createFileRoute } from "@tanstack/react-router";
import { Bookmark } from "lucide-react";
import { AppLink } from "../components/app-shell";
import { PlaceholderPage } from "../components/placeholder-page";

export const Route = createFileRoute("/saved")({
	head: () => ({ meta: [{ title: "Saved events & places · Tardis" }] }),
	component: () => (
		<PlaceholderPage
			eyebrow="Your collection"
			title="Saved events & places"
			description="A place to keep the events and destinations you want to come back to."
			icon={Bookmark}
		>
			<AppLink to="/" className="primary-link">
				Explore the map
			</AppLink>
		</PlaceholderPage>
	),
});
