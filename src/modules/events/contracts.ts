import { z } from "zod";
import {
	dateSchema,
	idSchema,
	locationSchema,
	pricesSchema,
	tagIdsSchema,
	timeFields,
	timezoneSchema,
	validTimes,
	visibilitySchema,
} from "../../shared/validation";
import { validateRule } from "./recurrence";
export const dayInputSchema = z
	.strictObject({
		date: dateSchema,
		description: z.string().max(10000).nullable().optional(),
		...timeFields,
	})
	.refine(
		validTimes,
		"Timed days require one valid interval; other kinds omit times",
	);
export const recurrenceDaySchema = z
	.strictObject({
		dayOffset: z.number().int().min(0).max(365),
		description: z.string().max(10000).nullable().optional(),
		...timeFields,
	})
	.refine(validTimes, "Invalid template times");
export const recurrenceInputSchema = z
	.strictObject({
		mode: z.enum(["scheduled", "expected"]),
		anchorDate: dateSchema,
		untilDate: dateSchema.nullable().optional(),
		rrule: z.string().max(1000).nullable().optional(),
		intervalMonths: z.number().int().min(1).max(1200).nullable().optional(),
		days: z.array(recurrenceDaySchema).max(366).default([]),
	})
	.superRefine((v, ctx) => {
		const fail = (message: string) => ctx.addIssue({ code: "custom", message });
		if (v.untilDate && v.untilDate < v.anchorDate)
			fail("Recurrence end precedes anchor");
		if (new Set(v.days.map((d) => d.dayOffset)).size !== v.days.length)
			fail("Duplicate template day");
		if (v.mode === "expected") {
			if (!v.intervalMonths || v.rrule != null || v.days.length)
				fail(
					"Expected recurrence requires a month interval and no exact schedule",
				);
		} else {
			if (!v.rrule || v.intervalMonths != null || !v.days.length)
				fail("Scheduled recurrence requires a rule and day template");
			else
				try {
					validateRule(v.rrule, v.anchorDate);
				} catch (e) {
					fail(e instanceof Error ? e.message : "Invalid rule");
				}
		}
	});
export const eventInputSchema = z
	.strictObject({
		title: z.string().trim().min(1).max(200),
		description: z.string().max(10000).nullable().optional(),
		visibility: visibilitySchema.default("private"),
		timezone: timezoneSchema,
		placeId: idSchema.nullable().optional(),
		location: locationSchema.optional(),
		tagIds: tagIdsSchema,
		prices: pricesSchema,
	})
	.refine(
		(v) => !!v.placeId !== !!v.location,
		"Supply either a placeId or a standalone location",
	);
export const occurrenceInputSchema = z
	.strictObject({
		datePrecision: z.enum(["exact", "month"]),
		status: z
			.enum(["scheduled", "tentative", "cancelled"])
			.default("scheduled"),
		expectedMonth: dateSchema.nullable().optional(),
		days: z.array(dayInputSchema).max(366).default([]),
		recurrenceId: idSchema.nullable().optional(),
		originalAnchor: dateSchema.nullable().optional(),
		placeId: idSchema.nullable().optional(),
		location: locationSchema.optional(),
		timezone: timezoneSchema.optional(),
		title: z.string().trim().min(1).max(200).nullable().optional(),
		description: z.string().max(10000).nullable().optional(),
		prices: pricesSchema,
	})
	.superRefine((v, ctx) => {
		const fail = (message: string) => ctx.addIssue({ code: "custom", message });
		if (v.placeId && v.location)
			fail("Choose a place or a standalone location");
		if (!!v.recurrenceId !== !!v.originalAnchor)
			fail("Recurrence and original anchor must be supplied together");
		if (v.datePrecision === "month") {
			if (
				!v.expectedMonth?.endsWith("-01") ||
				v.days.length ||
				v.status === "scheduled"
			)
				fail(
					"Month placeholders need a month start, tentative/cancelled status, and no days",
				);
		} else if (v.expectedMonth != null || !v.days.length)
			fail("Exact occurrences require days and no expected month");
		if (new Set(v.days.map((d) => d.date)).size !== v.days.length)
			fail("Only one interval per event day is supported");
	});
export type EventInput = z.infer<typeof eventInputSchema>;
export type OccurrenceInput = z.infer<typeof occurrenceInputSchema>;
export type RecurrenceInput = z.infer<typeof recurrenceInputSchema>;
