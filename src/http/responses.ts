import { z } from "zod";

const id = z.uuid();
const date = z.iso.date();
const instant = z.iso.datetime({ offset: true });
const text = z.string().nullable();
const entity = { id, createdAt: instant, updatedAt: instant };
const venue = { locationId: id, timezone: z.string() };
const visibility = z.enum(["public", "private"]);
export const locationResponse = z.object({
	id,
	label: z.string(),
	address: text,
	latitude: z.number(),
	longitude: z.number(),
});
export const tagResponse = z.object({ id, slug: z.string(), name: z.string() });
export const priceResponse = z.object({
	...entity,
	label: z.string(),
	category: z.string(),
	coverage: z.enum(["admission", "day", "occurrence"]),
	amount: z.string().regex(/^\d+\.\d{2}$/),
	currency: z.string(),
	validFrom: date,
	validTo: date.nullable(),
	weekdays: z.array(z.number().int()),
	startMinute: z.number().int(),
	endMinute: z.number().int(),
});
export const eventResponse = z.object({
	...entity,
	...venue,
	title: z.string(),
	description: text,
	visibility,
	placeId: id.nullable(),
});
export const placeResponse = z.object({
	...entity,
	...venue,
	name: z.string(),
	description: text,
	visibility,
});
export const occurrenceResponse = z.object({
	...entity,
	...venue,
	eventId: id,
	recurrenceId: id.nullable(),
	originalAnchor: date.nullable(),
	status: z.enum(["scheduled", "tentative", "cancelled"]),
	datePrecision: z.enum(["exact", "month"]),
	startsOn: date.nullable(),
	endsOn: date.nullable(),
	expectedMonth: date.nullable(),
	placeId: id.nullable(),
	title: text,
	description: text,
});
const timeKind = z.enum(["timed", "all_day", "unknown"]);
const day = z.object({
	date,
	description: text,
	timeKind,
	startsAt: instant.nullable(),
	endsAt: instant.nullable(),
});
const template = z.object({
	dayOffset: z.number().int(),
	description: text.optional(),
	timeKind,
	startMinute: z.number().int().nullish(),
	endMinute: z.number().int().nullish(),
});
export const recurrenceResponse = z.object({
	...entity,
	eventId: id,
	mode: z.enum(["scheduled", "expected"]),
	anchorDate: date,
	untilDate: date.nullable(),
	rrule: text,
	intervalMonths: z.number().int().nullable(),
});
export const createdRecurrenceResponse = recurrenceResponse.extend({
	days: z.array(template),
	placeholder: occurrenceResponse.nullable(),
});
export const savedOccurrenceResponse = occurrenceResponse.extend({
	days: z.array(day),
});
export const occurrenceDetailResponse = savedOccurrenceResponse.extend({
	prices: z.array(priceResponse),
	location: locationResponse,
});
export const eventDetailResponse = eventResponse.extend({
	location: locationResponse,
	tags: z.array(tagResponse),
	prices: z.array(priceResponse),
	recurrences: z.array(recurrenceResponse.extend({ days: z.array(template) })),
});
const interval = z.object({
	startMinute: z.number().int(),
	endMinute: z.number().int(),
});
const state = z.enum(["open", "closed", "unknown"]);
export const exceptionResponse = z.object({
	...entity,
	placeId: id,
	date,
	state,
	note: text,
});
export const hoursResponse = z.object({
	schedules: z.array(
		z.object({
			...entity,
			placeId: id,
			label: text,
			validFrom: date,
			validTo: date.nullable(),
			weekdays: z.array(
				z.object({
					weekday: z.number().int(),
					state,
					intervals: z.array(interval),
				}),
			),
		}),
	),
	exceptions: z.array(
		exceptionResponse.extend({ intervals: z.array(interval) }),
	),
});
export const placeDetailResponse = placeResponse.extend({
	location: locationResponse,
	tags: z.array(tagResponse),
	prices: z.array(priceResponse),
	...hoursResponse.shape,
});
const available = {
	id: z.string(),
	title: z.string(),
	...venue,
	location: locationResponse,
	prices: z.array(priceResponse),
};
export const availabilityResponse = z.object({
	at: instant,
	items: z.array(
		z.discriminatedUnion("kind", [
			z.object({
				...available,
				kind: z.literal("event"),
				eventId: id,
				date,
				description: text,
				startsAt: instant.nullable(),
				endsAt: instant.nullable(),
			}),
			z.object({
				...available,
				kind: z.literal("place"),
				intervals: z.array(z.object({ startsAt: instant, endsAt: instant })),
			}),
		]),
	),
	total: z.number().int(),
	hasMore: z.boolean(),
});
export const errorSchema = z.object({
	error: z.string(),
	issues: z
		.array(
			z.object({
				path: z.array(z.union([z.string(), z.number()])),
				message: z.string(),
			}),
		)
		.optional(),
});
