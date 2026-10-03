import { Compass } from "lucide-react";
import { AppLink } from "../../../components/AppLink/AppLink";
import actionCss from "../../../components/AppLink/AppLink.module.css";
import { PlaceholderPage } from "../../../components/PlaceholderPage/PlaceholderPage";

export function NotFoundPage() {
	return (
		<PlaceholderPage
			eyebrow="Off the beaten path"
			title="Page not found"
			description="This destination isn’t on the map. Head back to explore."
			icon={Compass}
			comingSoon={false}
		>
			<AppLink to="/" className={actionCss.primaryLink}>
				Back to explore
			</AppLink>
		</PlaceholderPage>
	);
}
