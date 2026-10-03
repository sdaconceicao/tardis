import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { events } from "../modules/events/schema";
import { readable } from "./access";

const dialect = new PgDialect();
function queryFor(actor: { subject: string } | null) {
	const condition = readable(events.ownerId, events.visibility, actor);
	if (!condition) throw new Error("Visibility condition is required");
	return dialect.sqlToQuery(condition);
}

describe("readable visibility condition", () => {
	it("restricts anonymous reads to public rows", () => {
		const query = queryFor(null);
		expect(query.params).toEqual(["public"]);
		expect(query.sql).toContain("visibility");
		expect(query.sql).not.toContain("owner_id");
	});

	it("lets an actor see public rows and their own rows", () => {
		const query = queryFor({ subject: "owner" });
		expect(query.params).toEqual(["public", "owner"]);
		expect(query.sql).toContain(" or ");
		expect(query.sql).toContain("owner_id");
	});
});
