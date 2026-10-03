import { CalendarDays, Plus } from "lucide-react";
import { AppLink } from "../../../../components/AppLink/AppLink";
import actionCss from "../../../../components/AppLink/AppLink.module.css";
import { PlaceholderPage } from "../../../../components/PlaceholderPage/PlaceholderPage";

export function MyEventsPage() {
	return (
		<PlaceholderPage
			eyebrow="For the hosts"
			title="My events"
			description="Your drafts, upcoming events, and past gatherings will have a home here."
			icon={CalendarDays}
		>
			<AppLink to="/signup" className={actionCss.primaryLink}>
				<Plus aria-hidden="true" />
				Add event
			</AppLink>
		</PlaceholderPage>
	);
}
