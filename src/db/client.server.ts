import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getServerEnv } from "../config/env.server";
import * as schema from "./schema";

let database: ReturnType<typeof createDatabase> | undefined;
export function createDatabase(connectionString: string) {
	const pool = new Pool({
		connectionString,
		max: 5,
		idleTimeoutMillis: 10_000,
		connectionTimeoutMillis: 5_000,
	});
	return drizzle(pool, { schema });
}
export function getDatabase() {
	database ??= createDatabase(getServerEnv().DATABASE_URL);
	return database;
}
export type Database = ReturnType<typeof createDatabase>;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type Connection = Database | Transaction;
