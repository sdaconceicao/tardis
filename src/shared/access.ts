import { eq, or } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { Actor } from "../modules/identity/contracts";
export function readable(
	owner: PgColumn,
	visibility: PgColumn,
	actor: Actor | null,
) {
	return actor
		? or(eq(visibility, "public"), eq(owner, actor.subject))
		: eq(visibility, "public");
}
