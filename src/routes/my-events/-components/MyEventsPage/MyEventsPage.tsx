import { Alert, Button, Skeleton } from "@code-x/lago";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { AppLink } from "../../../../components/AppLink/AppLink";
import actionCss from "../../../../components/AppLink/AppLink.module.css";
import { useSession } from "../../../../modules/identity/auth-client";
import css from "./MyEventsPage.module.css";

type EventSummary = {
	id: string;
	title: string;
	description: string | null;
	visibility: "public" | "private";
};

export function MyEventsPage() {
	const {
		data: session,
		isPending: sessionPending,
		error: sessionError,
	} = useSession();
	const [events, setEvents] = useState<EventSummary[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState(false);
	const [hasMore, setHasMore] = useState(false);
	const [offset, setOffset] = useState(0);
	const userId = session?.user.id;

	useEffect(() => {
		if (!userId) return;
		const controller = new AbortController();
		setLoading(true);
		setError(false);
		fetch(`/api/v1/events/mine?limit=50&offset=${offset}`, {
			signal: controller.signal,
		})
			.then(async (response) => {
				if (!response.ok) throw new Error("Could not load events");
				return response.json() as Promise<EventSummary[]>;
			})
			.then((items) => {
				setEvents((previous) =>
					offset === 0 ? items : [...previous, ...items],
				);
				setHasMore(items.length === 50);
			})
			.catch(() => {
				if (!controller.signal.aborted) setError(true);
			})
			.finally(() => {
				if (!controller.signal.aborted) setLoading(false);
			});
		return () => controller.abort();
	}, [userId, offset]);

	return (
		<section className={css.myEventsPage}>
			<header className={css.heading}>
				<div>
					<p className={css.eyebrow}>For the hosts</p>
					<h1>My events</h1>
				</div>
				{session?.user && (
					<AppLink to="/my-events/new" className={actionCss.primaryLink}>
						<Plus aria-hidden="true" />
						Add Event
					</AppLink>
				)}
			</header>
			{sessionPending || (loading && events.length === 0) ? (
				<Skeleton variant="line" height={56} label="Loading events" />
			) : sessionError ? (
				<Alert variant="error" role="alert">
					<Alert.Body>
						Could not check your account. Refresh and try again.
					</Alert.Body>
				</Alert>
			) : !session?.user ? (
				<div className={css.empty}>
					<p>Sign in to add and manage your events.</p>
					<AppLink to="/login" search={{ next: "/my-events" }}>
						Sign in
					</AppLink>
				</div>
			) : error ? (
				<Alert variant="error" role="alert">
					<Alert.Body>
						Could not load your events. Refresh and try again.
					</Alert.Body>
				</Alert>
			) : events.length === 0 ? (
				<div className={css.empty}>
					<p>You have not created an event yet.</p>
					<AppLink to="/my-events/new">Add Event</AppLink>
				</div>
			) : (
				<>
					<ul className={css.list}>
						{events.map((event) => (
							<li key={event.id} className={css.card}>
								<div>
									<h2>{event.title}</h2>
									{event.description && <p>{event.description}</p>}
								</div>
								<span className={css.visibility}>{event.visibility}</span>
							</li>
						))}
					</ul>
					{hasMore && (
						<Button
							variant="secondary"
							isPending={loading}
							onPress={() => setOffset((value) => value + 50)}
						>
							Load more
						</Button>
					)}
				</>
			)}
		</section>
	);
}
