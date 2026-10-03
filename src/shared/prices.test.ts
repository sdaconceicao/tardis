import { describe, expect, it } from "vitest";
import { assertPriceWindows, occurrencePricesAt, pricesAt } from "./prices";
import { priceSchema } from "./validation";

const base = priceSchema.parse({
	amount: "10.00",
	currency: "USD",
	validFrom: "2026-01-01",
});

describe("price windows", () => {
	it("compares only matching labels, categories, coverage, dates, days, and minutes", () => {
		expect(() => assertPriceWindows([base, { ...base }])).toThrow(/overlap/);
		for (const different of [
			{ ...base, label: "Child" },
			{ ...base, category: "vip" },
			{ ...base, coverage: "day" as const },
			{ ...base, weekdays: [1] },
		]) {
			const first =
				different.weekdays === undefined ? base : { ...base, weekdays: [2] };
			expect(() => assertPriceWindows([first, different])).not.toThrow();
		}
		expect(() =>
			assertPriceWindows([
				{ ...base, validTo: "2026-09-18" },
				{ ...base, validFrom: "2026-09-18" },
			]),
		).not.toThrow();
		expect(() =>
			assertPriceWindows([
				{ ...base, endMinute: 600 },
				{ ...base, startMinute: 600 },
			]),
		).not.toThrow();
	});

	it("includes the opening minute and excludes the closing minute and validTo date", () => {
		const price = {
			...base,
			weekdays: [5],
			startMinute: 600,
			endMinute: 660,
			validTo: "2026-09-19",
		};
		expect(pricesAt([price], new Date("2026-09-18T10:00:00Z"), "UTC")).toEqual([
			price,
		]);
		expect(pricesAt([price], new Date("2026-09-18T11:00:00Z"), "UTC")).toEqual(
			[],
		);
		expect(pricesAt([price], new Date("2026-09-19T10:30:00Z"), "UTC")).toEqual(
			[],
		);
	});

	it("replaces only the matching default price for an occurrence", () => {
		const at = new Date("2026-09-18T12:00:00Z");
		const prices = [
			{ ...base, occurrenceId: null },
			{ ...base, label: "Child", occurrenceId: null },
			{ ...base, amount: "0.00", occurrenceId: "occurrence-a" },
			{ ...base, amount: "5.00", occurrenceId: "occurrence-b" },
		];
		expect(
			occurrencePricesAt(prices, "occurrence-a", at, "UTC").map(
				(p) => p.amount,
			),
		).toEqual(["10.00", "0.00"]);
		expect(
			occurrencePricesAt(prices, null, at, "UTC").map((p) => p.label),
		).toEqual(["Admission", "Child"]);
	});

	it("filters on weekday, local time, and the lower date bound", () => {
		const price = {
			...base,
			validFrom: "2026-09-18",
			weekdays: [5],
			startMinute: 600,
			endMinute: 660,
		};
		expect(pricesAt([price], new Date("2026-09-18T09:59:00Z"), "UTC")).toEqual(
			[],
		);
		expect(pricesAt([price], new Date("2026-09-18T10:00:00Z"), "UTC")).toEqual([
			price,
		]);
		expect(pricesAt([price], new Date("2026-09-19T10:00:00Z"), "UTC")).toEqual(
			[],
		);
		expect(
			pricesAt(
				[{ ...price, validFrom: "2026-09-19" }],
				new Date("2026-09-18T10:00:00Z"),
				"UTC",
			),
		).toEqual([]);
	});

	it("keeps a default price when its occurrence override is not currently valid", () => {
		const at = new Date("2026-09-18T12:00:00Z");
		const fallback = { ...base, occurrenceId: null };
		const inactiveOverride = {
			...base,
			amount: "0.00",
			occurrenceId: "edition",
			weekdays: [6],
		};
		expect(
			occurrencePricesAt([fallback, inactiveOverride], "edition", at, "UTC"),
		).toEqual([fallback]);
	});
});
