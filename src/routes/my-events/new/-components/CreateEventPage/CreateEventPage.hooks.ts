import type { SearchSuggestion } from "@code-x/lago";
import { type FormEvent, useCallback, useMemo, useState } from "react";
import { ZodError } from "zod";
import { useSession } from "../../../../../modules/identity/auth-client";
import {
	buildEventCreation,
	type Draft,
	type EventDay,
	type EventLocation,
	firstEventDate,
	initialDraft,
	newDay,
	type SelectedPoi,
	selectedWeekdays,
} from "./CreateEventPage.utils";

export type PlaceSuggestion = SearchSuggestion & { place: SelectedPoi };

async function loadPlaceSuggestions(query: string): Promise<PlaceSuggestion[]> {
	const value = query.trim();
	if (value.length < 3) return [];
	const response = await fetch(
		`/api/v1/discovery/search?q=${encodeURIComponent(value)}`,
	);
	if (!response.ok) throw new Error("Place search failed");
	const places = (await response.json()) as SelectedPoi[];
	return places.map((place) => ({ id: place.id, label: place.name, place }));
}

async function write(path: string, body: unknown): Promise<{ id: string }> {
	const response = await fetch(`/api/v1${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "same-origin",
		body: JSON.stringify(body),
	});
	if (!response.ok) {
		const result = await response.json().catch(() => null);
		throw new Error(result?.error || `Could not save (${response.status}).`);
	}
	return response.json() as Promise<{ id: string }>;
}

export function useCreateEventPage() {
	const {
		data: session,
		isPending: sessionPending,
		error: sessionError,
	} = useSession();
	const [draft, setDraft] = useState<Draft>(initialDraft);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [created, setCreated] = useState("");
	const firstDate = useMemo(() => firstEventDate(draft.days), [draft.days]);
	const weekdays = useMemo(() => selectedWeekdays(draft), [draft]);

	const update = useCallback(
		<K extends keyof Draft>(key: K, value: Draft[K]) => {
			setDraft((previous) => ({ ...previous, [key]: value }));
		},
		[],
	);
	const updateLocation = useCallback(
		(change: (previous: EventLocation) => EventLocation) => {
			setDraft((previous) => ({
				...previous,
				location: change(previous.location),
			}));
		},
		[],
	);
	const updateDay = useCallback((id: string, changes: Partial<EventDay>) => {
		setDraft((previous) => ({
			...previous,
			days: previous.days.map((day) =>
				day.id === id ? { ...day, ...changes } : day,
			),
		}));
	}, []);
	const addDay = useCallback(() => {
		setDraft((previous) => ({
			...previous,
			days: [...previous.days, newDay()],
		}));
	}, []);
	const removeDay = useCallback((id: string) => {
		setDraft((previous) => ({
			...previous,
			days: previous.days.filter((day) => day.id !== id),
		}));
	}, []);
	const reset = useCallback(() => {
		setDraft(initialDraft());
		setCreated("");
		setError("");
	}, []);

	const save = useCallback(
		async (event: FormEvent) => {
			event.preventDefault();
			setError("");
			let input: ReturnType<typeof buildEventCreation>;
			try {
				input = buildEventCreation(draft);
			} catch (cause) {
				setError(
					cause instanceof ZodError
						? (cause.issues[0]?.message ?? "Check the event details.")
						: cause instanceof Error
							? cause.message
							: "Check the event details.",
				);
				return;
			}
			setSaving(true);
			let eventId: string | null = null;
			try {
				const createdEvent = await write("/events", input.event);
				eventId = createdEvent.id;
				if (input.recurrence?.mode === "scheduled") {
					const rule = await write(
						`/events/${eventId}/recurrences`,
						input.recurrence,
					);
					await write(`/events/${eventId}/occurrences`, {
						...input.occurrence,
						recurrenceId: rule.id,
						originalAnchor: input.recurrence.anchorDate,
					});
				} else {
					await write(`/events/${eventId}/occurrences`, input.occurrence);
					if (input.recurrence)
						await write(`/events/${eventId}/recurrences`, input.recurrence);
				}
				setCreated(input.event.title);
			} catch (cause) {
				if (eventId) {
					const rollback = await fetch(`/api/v1/events/${eventId}`, {
						method: "DELETE",
						credentials: "same-origin",
					}).catch(() => null);
					setError(
						rollback?.ok
							? cause instanceof Error
								? cause.message
								: "Could not add the event."
							: "The schedule could not be saved. The event may remain in your account; please check before trying again.",
					);
				} else {
					setError(
						cause instanceof Error ? cause.message : "Could not add the event.",
					);
				}
			} finally {
				setSaving(false);
			}
		},
		[draft],
	);

	return {
		session,
		sessionPending,
		sessionError,
		draft,
		saving,
		error,
		created,
		firstDate,
		weekdays,
		update,
		updateLocation,
		updateDay,
		addDay,
		removeDay,
		reset,
		save,
		loadPlaceSuggestions,
	};
}

export type CreateEventController = ReturnType<typeof useCreateEventPage>;
