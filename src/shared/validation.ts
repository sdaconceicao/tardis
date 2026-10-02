import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";
export const idSchema = z.uuid();
export const dateSchema = z.iso.date().refine((s) => {
	try {
		const date = Temporal.PlainDate.from(s);
		return date.year >= 1900 && date.year <= 2200;
	} catch {
		return false;
	}
}, "Use a valid date between 1900 and 2200");
export const timezoneSchema = z
	.string()
	.max(100)
	.refine((s) => {
		try {
			new Intl.DateTimeFormat("en", { timeZone: s });
			return true;
		} catch {
			return false;
		}
	}, "Invalid IANA time zone");
export const visibilitySchema = z.enum(["public", "private"]);
export const locationSchema = z.strictObject({
	label: z.string().trim().min(1).max(200),
	address: z.string().max(1000).nullable().optional(),
	latitude: z.number().min(-90).max(90),
	longitude: z.number().min(-180).max(180),
});
export const tagIdsSchema = z
	.array(idSchema)
	.max(50)
	.refine((ids) => new Set(ids).size === ids.length, "Duplicate tags")
	.default([]);
export const intervalSchema = z
	.strictObject({
		startMinute: z.number().int().min(0).max(1439),
		endMinute: z.number().int().min(1).max(2880),
	})
	.refine((v) => v.endMinute > v.startMinute, "End must follow start");
export const timeFields = {
	timeKind: z.enum(["timed", "all_day", "unknown"]),
	startMinute: z.number().int().min(0).max(1439).nullable().optional(),
	endMinute: z.number().int().min(1).max(2880).nullable().optional(),
};
export function validTimes(v: {
	timeKind: string;
	startMinute?: number | null;
	endMinute?: number | null;
}) {
	return v.timeKind === "timed"
		? v.startMinute != null &&
				v.endMinute != null &&
				v.endMinute > v.startMinute
		: v.startMinute == null && v.endMinute == null;
}
export const priceSchema = z
	.strictObject({
		label: z.string().trim().min(1).max(100).default("Admission"),
		category: z.string().trim().min(1).max(100).default("general"),
		coverage: z.enum(["admission", "day", "occurrence"]).default("admission"),
		amount: z
			.string()
			.regex(
				/^\d{1,10}(\.\d{1,2})?$/,
				"Use an exact nonnegative decimal amount",
			),
		currency: z.string().regex(/^[A-Z]{3}$/),
		validFrom: dateSchema,
		validTo: dateSchema.nullable().optional(),
		weekdays: z
			.array(z.number().int().min(1).max(7))
			.min(1)
			.max(7)
			.default([1, 2, 3, 4, 5, 6, 7]),
		startMinute: z.number().int().min(0).max(1439).default(0),
		endMinute: z.number().int().min(1).max(1440).default(1440),
	})
	.refine(
		(v) =>
			(!v.validTo || v.validTo > v.validFrom) &&
			v.endMinute > v.startMinute &&
			new Set(v.weekdays).size === v.weekdays.length,
		"Invalid price window",
	);
export const pricesSchema = z.array(priceSchema).max(100).default([]);
export const listSchema = z.object({
	limit: z.coerce.number().int().min(1).max(100).default(50),
	offset: z.coerce.number().int().min(0).max(10000).default(0),
});
export const availabilitySchema = z.object({
	at: z.iso
		.datetime({ offset: true })
		.refine(
			(s) => dateSchema.safeParse(s.slice(0, 10)).success,
			"Use a date between 1900 and 2200",
		)
		.transform((s) => new Date(s)),
	latitude: z.coerce.number().min(-90).max(90),
	longitude: z.coerce.number().min(-180).max(180),
	radiusMeters: z.coerce.number().int().min(1).max(100000).default(25000),
	limit: z.coerce.number().int().min(1).max(100).default(50),
	offset: z.coerce.number().int().min(0).max(10000).default(0),
});
export type AvailabilityQuery = z.infer<typeof availabilitySchema>;
