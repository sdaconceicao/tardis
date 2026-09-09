import { drizzle } from "drizzle-orm/neon-http";

import { getServerEnv } from "#/config/env.server";
import * as schema from "./schema";

export function getDatabase() {
	const { DATABASE_URL } = getServerEnv();

	return drizzle(DATABASE_URL, { schema });
}

export type Database = ReturnType<typeof getDatabase>;
