import { z } from "zod";
import {
	dateSchema,
	intervalSchema,
	locationSchema,
	pricesSchema,
	tagIdsSchema,
	timezoneSchema,
	visibilitySchema,
} from "../../shared/validation";

const hoursFields = {
	state: z.enum(["open", "closed", "unknown"]),
	intervals: z.array(intervalSchema).max(10).default([]),
};
function validHours(v: {
	state: string;
	intervals: { startMinute: number; endMinute: number }[];
}) {
	const sorted = [...v.intervals].sort((a, b) => a.startMinute - b.startMinute);
	return v.state === "open"
		? sorted.length > 0 &&
				sorted.every(
					(v, i) => i === 0 || sorted[i - 1].endMinute <= v.startMinute,
				)
		: sorted.length === 0;
}
const weekdaySchema = z
	.strictObject({ weekday: z.number().int().min(1).max(7), ...hoursFields })
	.refine(
		validHours,
		"Open days need non-overlapping intervals; closed/unknown days must have none",
	);
export const scheduleSchema = z
	.strictObject({
		label: z.string().max(200).nullable().optional(),
		validFrom: dateSchema,
		validTo: dateSchema.nullable().optional(),
		weekdays: z.array(weekdaySchema).max(7),
	})
	.refine(
		(v) =>
			(!v.validTo || v.validTo > v.validFrom) &&
			new Set(v.weekdays.map((d) => d.weekday)).size === v.weekdays.length,
		"Invalid season or duplicate weekday",
	);
export const exceptionSchema = z
	.strictObject({
		date: dateSchema,
		note: z.string().max(2000).nullable().optional(),
		...hoursFields,
	})
	.refine(validHours, "Invalid exception intervals");
export const placeInputSchema = z.strictObject({
	name: z.string().trim().min(1).max(200),
	description: z.string().max(10000).nullable().optional(),
	visibility: visibilitySchema.default("private"),
	timezone: timezoneSchema,
	location: locationSchema,
	tagIds: tagIdsSchema,
	prices: pricesSchema,
});
export type PlaceInput = z.infer<typeof placeInputSchema>;
