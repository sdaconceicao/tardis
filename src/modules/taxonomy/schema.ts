import { index, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { entityColumns } from "../../db/schema/common";
import { events } from "../events/schema";
import { places } from "../places/schema";
export const tags = pgTable("tags", {
	...entityColumns(),
	slug: text("slug").notNull().unique(),
	name: text("name").notNull(),
});
export const eventTags = pgTable(
	"event_tags",
	{
		eventId: uuid("event_id")
			.notNull()
			.references(() => events.id, { onDelete: "cascade" }),
		tagId: uuid("tag_id")
			.notNull()
			.references(() => tags.id),
	},
	(t) => [
		primaryKey({ columns: [t.eventId, t.tagId] }),
		index("event_tags_tag_idx").on(t.tagId),
	],
);
export const placeTags = pgTable(
	"place_tags",
	{
		placeId: uuid("place_id")
			.notNull()
			.references(() => places.id, { onDelete: "cascade" }),
		tagId: uuid("tag_id")
			.notNull()
			.references(() => tags.id),
	},
	(t) => [
		primaryKey({ columns: [t.placeId, t.tagId] }),
		index("place_tags_tag_idx").on(t.tagId),
	],
);
