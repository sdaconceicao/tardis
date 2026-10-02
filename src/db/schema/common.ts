import { pgEnum, timestamp, uuid } from "drizzle-orm/pg-core";
export const visibility = pgEnum("visibility", ["public", "private"]);
export const timeKind = pgEnum("time_kind", ["timed", "all_day", "unknown"]);
export const hoursState = pgEnum("hours_state", ["open", "closed", "unknown"]);
export const entityColumns = () => ({
	id: uuid("id").primaryKey().defaultRandom(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date()),
});
