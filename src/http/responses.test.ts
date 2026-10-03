import { describe, expect, it } from "vitest";
import { availabilityResponse, errorSchema, priceResponse } from "./responses";

const id = "550e8400-e29b-41d4-a716-446655440000";
const location = {
	id,
	label: "Park",
	address: null,
	latitude: 40,
	longitude: -73,
};
const price = {
	id,
	createdAt: "2026-09-18T12:00:00Z",
	updatedAt: "2026-09-18T12:00:00Z",
	label: "Admission",
	category: "general",
	coverage: "admission",
	amount: "10.00",
	currency: "USD",
	validFrom: "2026-01-01",
	validTo: null,
	weekdays: [1, 2, 3, 4, 5, 6, 7],
	startMinute: 0,
	endMinute: 1440,
};

describe("API response contracts", () => {
	it("requires exact decimal price amounts", () => {
		expect(priceResponse.safeParse(price).success).toBe(true);
		expect(priceResponse.safeParse({ ...price, amount: "10.0" }).success).toBe(
			false,
		);
		expect(
			priceResponse.safeParse({ ...price, coverage: "invalid" }).success,
		).toBe(false);
	});

	it("accepts each availability kind with its own required fields", () => {
		const common = {
			id,
			title: "Park",
			locationId: id,
			timezone: "UTC",
			location,
			prices: [],
		};
		const envelope = { at: "2026-09-18T12:00:00Z", total: 1, hasMore: false };
		const place = {
			...common,
			kind: "place",
			intervals: [{ startsAt: envelope.at, endsAt: "2026-09-18T13:00:00Z" }],
		};
		const event = {
			...common,
			kind: "event",
			eventId: id,
			date: "2026-09-18",
			description: null,
			startsAt: envelope.at,
			endsAt: "2026-09-18T13:00:00Z",
		};
		expect(
			availabilityResponse.safeParse({ ...envelope, items: [place] }).success,
		).toBe(true);
		expect(
			availabilityResponse.safeParse({ ...envelope, items: [event] }).success,
		).toBe(true);
		expect(
			availabilityResponse.safeParse({
				...envelope,
				items: [{ ...event, eventId: undefined }],
			}).success,
		).toBe(false);
	});

	it("keeps validation details structured and optional", () => {
		expect(errorSchema.parse({ error: "Invalid request" })).toEqual({
			error: "Invalid request",
		});
		expect(
			errorSchema.safeParse({
				error: "Invalid request",
				issues: [{ path: ["prices", 0], message: "Invalid amount" }],
			}).success,
		).toBe(true);
		expect(
			errorSchema.safeParse({
				error: "Invalid request",
				issues: [{ path: [true], message: "Invalid amount" }],
			}).success,
		).toBe(false);
	});
});
