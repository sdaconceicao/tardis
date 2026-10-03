import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import {
	createTag,
	listTags,
	setEventTags,
	setPlaceTags,
	tagInputSchema,
} from "./index.server";

describe("taxonomy service", () => {
	it("accepts clean slugs and rejects malformed or overlong names", () => {
		expect(
			tagInputSchema.parse({ slug: "live-music", name: " Music " }),
		).toEqual({ slug: "live-music", name: "Music" });
		for (const slug of ["Live-Music", "-music", "music--live", "music_"])
			expect(tagInputSchema.safeParse({ slug, name: "Music" }).success).toBe(
				false,
			);
		expect(tagInputSchema.safeParse({ slug: "music", name: " " }).success).toBe(
			false,
		);
	});

	it("escapes search wildcards before querying tags", async () => {
		const limit = vi.fn().mockResolvedValue([]);
		const orderBy = vi.fn(() => ({ limit }));
		const where = vi.fn((_condition: unknown) => ({ orderBy }));
		const from = vi.fn(() => ({ where }));
		const db = { select: vi.fn(() => ({ from })) };
		await listTags(db as never, "50%_off");
		const condition = where.mock.calls[0][0];
		expect(new PgDialect().sqlToQuery(condition as never).params).toEqual([
			"%50\\%\\_off%",
		]);
		expect(limit).toHaveBeenCalledWith(100);
	});

	it("creates tags and replaces event tag links", async () => {
		const returning = vi
			.fn()
			.mockResolvedValue([{ id: "tag", slug: "music", name: "Music" }]);
		const values = vi.fn(() => ({ returning }));
		const insert = vi.fn(() => ({ values }));
		const where = vi.fn().mockResolvedValue(undefined);
		const deleteRows = vi.fn(() => ({ where }));
		const db = { insert, delete: deleteRows };
		await expect(
			createTag(db as never, { slug: "music", name: "Music" }),
		).resolves.toMatchObject({ id: "tag" });
		await setEventTags(db as never, "event", []);
		expect(insert).toHaveBeenCalledTimes(1);
		await setEventTags(db as never, "event", ["tag-a", "tag-b"]);
		expect(values).toHaveBeenLastCalledWith([
			{ eventId: "event", tagId: "tag-a" },
			{ eventId: "event", tagId: "tag-b" },
		]);
	});

	it("replaces place tag links with the requested IDs", async () => {
		const values = vi.fn().mockResolvedValue(undefined);
		const insert = vi.fn(() => ({ values }));
		const deleteRows = vi.fn(() => ({ where: async () => undefined }));
		await setPlaceTags({ insert, delete: deleteRows } as never, "place", [
			"tag-a",
			"tag-b",
		]);
		expect(values).toHaveBeenCalledWith([
			{ placeId: "place", tagId: "tag-a" },
			{ placeId: "place", tagId: "tag-b" },
		]);
	});
});
