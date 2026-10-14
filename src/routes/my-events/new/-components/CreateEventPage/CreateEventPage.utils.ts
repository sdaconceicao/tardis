import { Temporal } from "@js-temporal/polyfill";
import {
	eventInputSchema,
	occurrenceInputSchema,
	recurrenceInputSchema,
} from "../../../../../modules/events/contracts";
import { validateRule } from "../../../../../modules/events/recurrence";
import {
	type AddressMatch,
	emptyPostalAddress,
	formatPostalAddress,
	type PostalAddress,
} from "../../../../../modules/places/geocoding";

export type EventDay = {
	id: string;
	date: string;
	description: string;
	timeKind: "timed" | "all_day" | "unknown";
	startsAt: string;
	endsAt: string;
	endsNextDay: boolean;
};
export type SelectedPoi = {
	id: string;
	name: string;
	address: string | null;
	latitude: number;
	longitude: number;
	timezone: string;
};
export type EventLocation = {
	name: string;
	address: PostalAddress;
	poi: SelectedPoi | null;
	match: (AddressMatch & { source: "address" | "poi" }) | null;
};
export type Draft = {
	title: string;
	description: string;
	visibility: "public" | "private";
	location: EventLocation;
	days: EventDay[];
	recurrence: "once" | "scheduled" | "expected";
	frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
	weekdays: string[];
	interval: number;
	untilDate: string;
	expectedMonths: number;
};

export const newDay = (): EventDay => ({
	id: crypto.randomUUID(),
	date: "",
	description: "",
	timeKind: "timed",
	startsAt: "09:00",
	endsAt: "17:00",
	endsNextDay: false,
});

export const emptyEventLocation = (): EventLocation => ({
	name: "",
	address: emptyPostalAddress(),
	poi: null,
	match: null,
});

export const initialDraft = (): Draft => ({
	title: "",
	description: "",
	visibility: "private",
	location: emptyEventLocation(),
	days: [newDay()],
	recurrence: "once",
	frequency: "YEARLY",
	weekdays: [],
	interval: 1,
	untilDate: "",
	expectedMonths: 12,
});

export function firstEventDate(days: EventDay[]): string | undefined {
	return days
		.map((day) => day.date)
		.filter(Boolean)
		.sort()[0];
}

export function selectedWeekdays(draft: Draft): string[] {
	if (draft.weekdays.length) return draft.weekdays;
	const date = firstEventDate(draft.days);
	if (!date) return [];
	return [
		["SU", "MO", "TU", "WE", "TH", "FR", "SA"][
			new Date(`${date}T12:00:00Z`).getUTCDay()
		],
	];
}

function minute(value: string) {
	if (!/^\d{2}:\d{2}$/.test(value))
		throw new Error("Enter valid start and end times.");
	const [hour, minute] = value.split(":").map(Number);
	if (
		!Number.isInteger(hour) ||
		!Number.isInteger(minute) ||
		hour > 23 ||
		minute > 59
	) {
		throw new Error("Enter valid start and end times.");
	}
	return hour * 60 + minute;
}

export function buildEventCreation(draft: Draft) {
	const { location } = draft;
	if (!location.poi && !location.match)
		throw new Error("Choose a place or find and select an address.");
	if (!location.poi) {
		if (!location.name.trim()) throw new Error("Enter a location name.");
		if (
			location.match?.source !== "poi" &&
			(!location.address.line1 ||
				!location.address.city ||
				!location.address.region ||
				!location.address.country)
		)
			throw new Error(
				"Enter address line 1, city, state or region, and country.",
			);
	}
	const sorted = [...draft.days].sort((a, b) => a.date.localeCompare(b.date));
	if (sorted.some((day) => !day.date))
		throw new Error("Enter a date for every event day.");
	const days = sorted.map((day) => {
		let times: { startMinute?: number; endMinute?: number } = {};
		if (day.timeKind === "timed") {
			const startMinute = minute(day.startsAt);
			const endMinute = minute(day.endsAt) + (day.endsNextDay ? 1440 : 0);
			if (endMinute <= startMinute) {
				throw new Error("Each day's end time must follow its start time.");
			}
			times = { startMinute, endMinute };
		}
		return {
			date: day.date,
			description: day.description.trim() || undefined,
			timeKind: day.timeKind,
			...times,
		};
	});
	const venue = location.poi
		? { timezone: location.poi.timezone, placeId: location.poi.id }
		: {
				timezone: location.match?.timezone,
				location: {
					label: location.name.trim(),
					address:
						location.match?.source === "poi" &&
						!location.address.line1 &&
						location.match.label
							? location.match.label
							: formatPostalAddress(location.address) || null,
					latitude: location.match?.latitude,
					longitude: location.match?.longitude,
				},
			};
	const event = eventInputSchema.parse({
		title: draft.title,
		description: draft.description.trim() || undefined,
		visibility: draft.visibility,
		...venue,
	});
	const occurrence = occurrenceInputSchema.parse({
		datePrecision: "exact",
		days,
	});
	if (draft.recurrence === "once")
		return { event, occurrence, recurrence: null };
	const anchorDate = days[0].date;
	if (draft.recurrence === "expected") {
		return {
			event,
			occurrence,
			recurrence: recurrenceInputSchema.parse({
				mode: "expected",
				anchorDate,
				intervalMonths: draft.expectedMonths,
			}),
		};
	}
	const anchor = Temporal.PlainDate.from(anchorDate);
	const weekday = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"][
		anchor.dayOfWeek - 1
	];
	const weekdays = draft.weekdays.length ? draft.weekdays : [weekday];
	if (draft.frequency === "WEEKLY" && sorted.length > 1 && weekdays.length > 1)
		throw new Error("A multi-day event can repeat on only one weekday.");
	if (draft.frequency === "WEEKLY" && !weekdays.includes(weekday))
		throw new Error(
			"Choose the first event date's weekday as one of the repeat days.",
		);
	const template = days.map((day) => ({
		dayOffset: anchor.until(Temporal.PlainDate.from(day.date)).days,
		description: day.description,
		timeKind: day.timeKind,
		startMinute: day.startMinute,
		endMinute: day.endMinute,
	}));
	const orderedWeekdays = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"].filter(
		(day) => weekdays.includes(day),
	);
	const rrule = `FREQ=${draft.frequency};INTERVAL=${draft.interval}${draft.frequency === "WEEKLY" ? `;BYDAY=${orderedWeekdays.join(",")}` : ""}`;
	const next = validateRule(rrule, anchorDate).after(
		new Date(`${anchorDate}T00:00:00Z`),
	);
	if (
		next &&
		(!draft.untilDate || next.toISOString().slice(0, 10) <= draft.untilDate) &&
		next.toISOString().slice(0, 10) <= (days.at(-1)?.date ?? anchorDate)
	)
		throw new Error(
			"The event days would overlap the next edition. Increase the repeat interval or shorten the event.",
		);
	return {
		event,
		occurrence,
		recurrence: recurrenceInputSchema.parse({
			mode: "scheduled",
			anchorDate,
			untilDate: draft.untilDate || undefined,
			rrule,
			days: template,
		}),
	};
}
