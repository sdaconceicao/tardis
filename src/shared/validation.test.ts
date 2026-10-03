import { describe, expect, it } from "vitest";
import {
	availabilitySchema,
	dateSchema,
	intervalSchema,
	listSchema,
	locationSchema,
	priceSchema,
	tagIdsSchema,
	timezoneSchema,
	validTimes,
} from "./validation";

describe("shared request validation", () => {
	it("accepts boundary dates and rejects impossible or out-of-range dates", () => {
		for (const date of ["1900-01-01", "2000-02-29", "2200-12-31"])
			expect(dateSchema.safeParse(date).success).toBe(true);
		for (const date of ["1899-12-31", "2201-01-01", "2026-02-30"])
			expect(dateSchema.safeParse(date).success).toBe(false);
	});

	it("requires a real timezone and bounded coordinates", () => {
		expect(timezoneSchema.safeParse("America/New_York").success).toBe(true);
		expect(timezoneSchema.safeParse("Nowhere/Invalid").success).toBe(false);
		expect(
			locationSchema.safeParse({
				label: " Here ",
				latitude: -90,
				longitude: 180,
			}).data?.label,
		).toBe("Here");
		expect(
			locationSchema.safeParse({ label: "Here", latitude: 91, longitude: 0 })
				.success,
		).toBe(false);
		expect(
			locationSchema.safeParse({
				label: "Here",
				latitude: 0,
				longitude: 0,
				ownerId: "other",
			}).success,
		).toBe(false);
	});

	it("rejects duplicate tags and reversed intervals", () => {
		const id = "550e8400-e29b-41d4-a716-446655440000";
		expect(tagIdsSchema.parse(undefined)).toEqual([]);
		expect(tagIdsSchema.safeParse([id, id]).success).toBe(false);
		expect(
			intervalSchema.safeParse({ startMinute: 0, endMinute: 1 }).success,
		).toBe(true);
		expect(
			intervalSchema.safeParse({ startMinute: 60, endMinute: 60 }).success,
		).toBe(false);
	});

	it("requires both minutes only for timed days", () => {
		expect(
			validTimes({ timeKind: "timed", startMinute: 0, endMinute: 1 }),
		).toBe(true);
		expect(
			validTimes({ timeKind: "timed", startMinute: 1, endMinute: 1 }),
		).toBe(false);
		expect(
			validTimes({ timeKind: "timed", startMinute: null, endMinute: 1 }),
		).toBe(false);
		expect(validTimes({ timeKind: "all_day" })).toBe(true);
		expect(validTimes({ timeKind: "unknown", startMinute: 0 })).toBe(false);
	});

	it("accepts exact prices and rejects invalid dates, amounts, and weekdays", () => {
		const price = { amount: "0.00", currency: "USD", validFrom: "2026-01-01" };
		expect(priceSchema.parse(price)).toMatchObject({
			label: "Admission",
			weekdays: [1, 2, 3, 4, 5, 6, 7],
		});
		for (const override of [
			{ amount: "-1" },
			{ amount: "1.234" },
			{ currency: "usd" },
			{ validTo: "2026-01-01" },
			{ weekdays: [1, 1] },
			{ startMinute: 600, endMinute: 600 },
		])
			expect(priceSchema.safeParse({ ...price, ...override }).success).toBe(
				false,
			);
	});

	it("coerces paging and availability defaults while bounding requests", () => {
		expect(listSchema.parse({})).toEqual({ limit: 50, offset: 0 });
		expect(listSchema.safeParse({ limit: 0 }).success).toBe(false);
		const query = availabilitySchema.parse({
			at: "2026-09-18T12:00:00Z",
			latitude: "40",
			longitude: "-73",
		});
		expect(query).toMatchObject({
			latitude: 40,
			longitude: -73,
			radiusMeters: 25000,
			limit: 50,
			offset: 0,
		});
		expect(query.at.toISOString()).toBe("2026-09-18T12:00:00.000Z");
		expect(
			availabilitySchema.safeParse({
				at: "2026-09-18T12:00:00Z",
				latitude: 0,
				longitude: 0,
				radiusMeters: 100001,
			}).success,
		).toBe(false);
	});
});
