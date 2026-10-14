import pg from "pg";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL is required");
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
const indexes = [
	{
		name: "places_catalog_name_trgm_idx",
		statement:
			"CREATE INDEX CONCURRENTLY IF NOT EXISTS places_catalog_name_trgm_idx ON places USING gin (name gin_trgm_ops) WHERE management_kind = 'catalog' AND visibility = 'public'",
	},
	{
		name: "locations_address_trgm_idx",
		statement:
			"CREATE INDEX CONCURRENTLY IF NOT EXISTS locations_address_trgm_idx ON locations USING gin (address gin_trgm_ops) WHERE address IS NOT NULL",
	},
];

try {
	await db.connect();
	await db.query("SET lock_timeout = '10s'");
	await db.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
	for (const { name, statement } of indexes) {
		const existing = await db.query(
			"SELECT i.indisvalid FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relname = $1",
			[name],
		);
		if (existing.rows.some((row) => !row.indisvalid)) {
			throw new Error(`${name} exists but is invalid; drop it before retrying`);
		}
		console.log(`Building ${name}...`);
		const started = Date.now();
		await db.query(statement);
		console.log(`${name} ready in ${Math.round((Date.now() - started) / 1000)}s`);
	}
} finally {
	await db.end();
}
