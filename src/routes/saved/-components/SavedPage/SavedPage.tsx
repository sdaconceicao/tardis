import { Bookmark } from "lucide-react";
import { AppLink } from "../../../../components/AppLink/AppLink";
import actionCss from "../../../../components/AppLink/AppLink.module.css";
import { PlaceholderPage } from "../../../../components/PlaceholderPage/PlaceholderPage";

export function SavedPage() {
	return (
		<PlaceholderPage
			eyebrow="Your collection"
			title="Saved events & places"
			description="A place to keep the events and destinations you want to come back to."
			icon={Bookmark}
		>
			<AppLink to="/" className={actionCss.primaryLink}>
				Explore the map
			</AppLink>
		</PlaceholderPage>
	);
}
