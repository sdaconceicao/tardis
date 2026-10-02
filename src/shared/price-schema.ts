import { sql } from "drizzle-orm";
import { check, date, integer, numeric, text } from "drizzle-orm/pg-core";

export const priceColumns = () => ({
	label: text("label").notNull().default("Admission"),
	category: text("category").notNull().default("general"),
	coverage: text("coverage")
		.$type<"admission" | "day" | "occurrence">()
		.notNull()
		.default("admission"),
	amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
	currency: text("currency").notNull(),
	validFrom: date("valid_from").notNull(),
	validTo: date("valid_to"),
	weekdays: integer("weekdays")
		.array()
		.notNull()
		.default(sql`ARRAY[1,2,3,4,5,6,7]::integer[]`),
	startMinute: integer("start_minute").notNull().default(0),
	endMinute: integer("end_minute").notNull().default(1440),
});
// The same row-local invariants apply to both domain-owned price tables.
export const priceChecks = (name: string) => [
	check(
		`${name}_amount_check`,
		sql`amount >= 0 AND amount <> 'NaN'::numeric AND currency ~ '^[A-Z]{3}$'`,
	),
	check(`${name}_dates_check`, sql`valid_to IS NULL OR valid_to > valid_from`),
	check(
		`${name}_time_check`,
		sql`start_minute >= 0 AND end_minute <= 1440 AND end_minute > start_minute`,
	),
	check(
		`${name}_weekdays_check`,
		sql`cardinality(weekdays) BETWEEN 1 AND 7 AND weekdays <@ ARRAY[1,2,3,4,5,6,7]::integer[] AND array_position(weekdays, NULL) IS NULL`,
	),
	check(
		`${name}_coverage_check`,
		sql`coverage IN ('admission', 'day', 'occurrence')`,
	),
];
