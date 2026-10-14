import { Alert, Button, Form } from "@code-x/lago";
import { AppLink } from "../../../../../components/AppLink/AppLink";
import { useCreateEventPage } from "./CreateEventPage.hooks";
import css from "./CreateEventPage.module.css";
import { EventDaysFields } from "./EventDaysFields";
import { EventDetailsFields } from "./EventDetailsFields";
import { EventLocationField } from "./EventLocationField";
import { EventRecurrenceFields } from "./EventRecurrenceFields";

export function CreateEventPage() {
	const controller = useCreateEventPage();
	const {
		session,
		sessionPending,
		sessionError,
		created,
		error,
		saving,
		save,
		reset,
	} = controller;

	if (sessionPending)
		return <p className={css.state}>Checking your account…</p>;
	if (sessionError)
		return (
			<Alert variant="error" role="alert">
				<Alert.Body>
					Could not check your account. Refresh and try again.
				</Alert.Body>
			</Alert>
		);
	if (!session?.user)
		return (
			<section className={css.createEventPage}>
				<h1>Create Event</h1>
				<p>Sign in to add an event.</p>
				<AppLink to="/login" search={{ next: "/my-events/new" }}>
					Sign in
				</AppLink>
				<span> · </span>
				<AppLink to="/signup" search={{ next: "/my-events/new" }}>
					Create an account
				</AppLink>
			</section>
		);
	if (created)
		return (
			<section className={css.createEventPage}>
				<Alert variant="success" role="status">
					<Alert.Body>“{created}” was added.</Alert.Body>
				</Alert>
				<AppLink to="/my-events">My events</AppLink>
				<Button variant="secondary" onPress={reset}>
					Add Event
				</Button>
			</section>
		);

	return (
		<section className={css.createEventPage}>
			<header className={css.heading}>
				<p className={css.eyebrow}>For the hosts</p>
				<h1>Create Event</h1>
				<p>Add the venue and dates people need to plan a visit.</p>
			</header>
			<Form className={css.form} onSubmit={save}>
				{error && (
					<Alert variant="error" role="alert">
						<Alert.Body>{error}</Alert.Body>
					</Alert>
				)}
				<div className={css.columns}>
					<div className={css.leftColumn}>
						<EventDetailsFields {...controller} />
						<EventLocationField {...controller} />
					</div>
					<div className={css.rightColumn}>
						<EventDaysFields {...controller} />
						<EventRecurrenceFields {...controller} />
					</div>
				</div>
				<Button type="submit" isPending={saving} isDisabled={saving}>
					{saving ? "Adding…" : "Add Event"}
				</Button>
			</Form>
		</section>
	);
}
