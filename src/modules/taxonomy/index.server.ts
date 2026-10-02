import { and, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import type { Connection } from "../../db/client.server";
import { eventTags, placeTags, tags } from "./schema";
export const tagInputSchema = z.strictObject({
	slug: z
		.string()
		.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
		.max(80),
	name: z.string().trim().min(1).max(100),
});
export async function listTags(db: Connection, query: string) {
	return db
		.select()
		.from(tags)
		.where(
			ilike(
				tags.name,
				`%${query.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`,
			),
		)
		.orderBy(tags.name)
		.limit(100);
}
export async function createTag(
	db: Connection,
	input: z.infer<typeof tagInputSchema>,
) {
	const [tag] = await db.insert(tags).values(input).returning();
	return tag;
}
export async function setEventTags(
	db: Connection,
	eventId: string,
	tagIds: string[],
) {
	await db.delete(eventTags).where(eq(eventTags.eventId, eventId));
	if (tagIds.length)
		await db
			.insert(eventTags)
			.values(tagIds.map((tagId) => ({ eventId, tagId })));
}
export async function setPlaceTags(
	db: Connection,
	placeId: string,
	tagIds: string[],
) {
	await db.delete(placeTags).where(eq(placeTags.placeId, placeId));
	if (tagIds.length)
		await db
			.insert(placeTags)
			.values(tagIds.map((tagId) => ({ placeId, tagId })));
}
export async function getEventTags(db: Connection, eventId: string) {
	return db
		.select({ id: tags.id, slug: tags.slug, name: tags.name })
		.from(tags)
		.innerJoin(
			eventTags,
			and(eq(tags.id, eventTags.tagId), eq(eventTags.eventId, eventId)),
		);
}
export async function getPlaceTags(db: Connection, placeId: string) {
	return db
		.select({ id: tags.id, slug: tags.slug, name: tags.name })
		.from(tags)
		.innerJoin(
			placeTags,
			and(eq(tags.id, placeTags.tagId), eq(placeTags.placeId, placeId)),
		);
}
