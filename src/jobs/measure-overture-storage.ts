import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { createGunzip } from "node:zlib";
import { config } from "dotenv";
import { Client } from "pg";
import { overtureProfiles } from "../../config/overture/profiles.ts";
import {
	type CatalogPlace,
	type ExtractedPlace,
	normalizeOverturePlace,
} from "../services/overture/normalize.ts";
import { resolveCategoryMapping } from "../services/overture/taxonomy.ts";

config({ path: [".env.local", ".env"] });
const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required");
const parsed = new URL(databaseUrl);
if (
	!parsed.pathname.endsWith("_test") ||
	!["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
)
	throw new Error(
		"Storage measurement requires a disposable local *_test database",
	);

const inputPaths: string[] = [];
let outputPath: string | undefined;
for (let index = 2; index < process.argv.length; index++) {
	const arg = process.argv[index];
	if (arg === "--input" && process.argv[index + 1])
		inputPaths.push(process.argv[++index]);
	else if (arg === "--output" && process.argv[index + 1])
		outputPath = process.argv[++index];
	else throw new Error(`Unknown or incomplete option: ${arg}`);
}
if (!inputPaths.length)
	throw new Error("At least one --input NDJSON file is required");

const taxonomy = await readFile(
	new URL("../../config/overture/taxonomy-2026-09-23.0.csv", import.meta.url),
	"utf8",
);
const mapping = resolveCategoryMapping(taxonomy);
const sample: CatalogPlace[] = [];
for (const path of inputPaths) {
	const input = path.endsWith(".gz")
		? createReadStream(path).pipe(createGunzip())
		: createReadStream(path);
	const lines = createInterface({ input, crlfDelay: Infinity });
	try {
		for await (const line of lines) {
			const raw = JSON.parse(line) as ExtractedPlace;
			if (
				raw.latitude === null ||
				raw.longitude === null ||
				raw.latitude < 18 ||
				raw.latitude > 72 ||
				raw.longitude < -179 ||
				raw.longitude > -66
			)
				continue;
			const normalized = normalizeOverturePlace(raw, "neon-free", mapping);
			if (normalized.value) sample.push(normalized.value);
			if (sample.length === 10_000) break;
		}
	} finally {
		lines.close();
		input.destroy();
	}
	if (sample.length === 10_000) break;
}
if (sample.length < 1000)
	throw new Error(`Need at least 1000 real POI rows; found ${sample.length}`);

const sizeSql = `SELECT pg_total_relation_size('locations') +
	pg_total_relation_size('places') + pg_total_relation_size('place_sources') AS bytes`;
const client = new Client({ connectionString: databaseUrl });
try {
	await client.connect();
	await client.query("BEGIN");
	// The row-level timezone trigger is covered by integration tests; this probes storage only.
	await client.query("ALTER TABLE places DISABLE TRIGGER places_timezone");
	const before = Number((await client.query(sizeSql)).rows[0].bytes);
	const run = await client.query(
		`INSERT INTO place_import_runs (release, profile, selection_fingerprint, resolved_config, manifest_url)
		VALUES ('2026-09-23.1', 'neon-free', gen_random_uuid()::text, '{}'::jsonb, 'storage-probe') RETURNING id`,
	);
	const runId = run.rows[0].id as string;
	await client.query(`CREATE TEMP TABLE storage_probe (
		location_id uuid NOT NULL, place_id uuid NOT NULL,
		external_id text NOT NULL, name text NOT NULL, address text,
		latitude double precision NOT NULL, longitude double precision NOT NULL,
		timezone text NOT NULL, category text, taxonomy_primary text,
		operating_status text, confidence double precision, content_hash text NOT NULL
	) ON COMMIT DROP`);
	for (let offset = 0; offset < sample.length; offset += 1000) {
		const rows = sample.slice(offset, offset + 1000).map((row) => ({
			external_id: row.externalId,
			name: row.name,
			address: row.address,
			latitude: row.latitude,
			longitude: row.longitude,
			timezone: row.timezone,
			category: row.category,
			taxonomy_primary: row.taxonomyPrimary,
			operating_status: row.operatingStatus,
			confidence: row.confidence,
			content_hash: row.contentHash.toString("hex"),
		}));
		await client.query(
			`INSERT INTO storage_probe
			SELECT gen_random_uuid(), gen_random_uuid(), row.*
			FROM jsonb_to_recordset($1::jsonb) AS row(
				external_id text, name text, address text,
				latitude double precision, longitude double precision,
				timezone text, category text, taxonomy_primary text,
				operating_status text, confidence double precision, content_hash text
			)`,
			[JSON.stringify(rows)],
		);
	}
	await client.query(`INSERT INTO locations (id, label, address, latitude, longitude)
		SELECT location_id, name, address, latitude, longitude FROM storage_probe`);
	await client.query(`INSERT INTO places (id, name, owner_id, management_kind, visibility, location_id, timezone)
		SELECT place_id, name, NULL, 'catalog', 'public', location_id, timezone FROM storage_probe`);
	await client.query(
		`INSERT INTO place_sources (
			place_id, applied_run_id, provider, external_id, content_hash,
			state, category, taxonomy_primary, operating_status, confidence, attribution
		)
		SELECT place_id, $1::uuid, 'overture', external_id, decode(content_hash, 'hex'),
			'active', category, taxonomy_primary, operating_status, confidence, 'Overture Maps Foundation'
		FROM storage_probe`,
		[runId],
	);
	const after = Number((await client.query(sizeSql)).rows[0].bytes);
	const bytesPerPlace = (after - before) / sample.length;
	const profileRows = 154_464;
	const report = {
		release: "2026-09-23.1",
		selectionVersion: overtureProfiles["neon-free"].version,
		profileRows,
		sampleRows: sample.length,
		sampleSha256: createHash("sha256")
			.update(sample.map((row) => row.contentHash.toString("hex")).join(""))
			.digest("hex"),
		sampleSelection:
			"Real Overture museums and entertainment rows in a broad US bounding box",
		beforeBytes: before,
		afterBytes: after,
		incrementalBytes: after - before,
		bytesPerPlace,
		projectedPlacesBytes: Math.ceil(bytesPerPlace * profileRows),
		placesBudgetBytes: overtureProfiles["neon-free"].limits.placesStorageBytes,
	};
	if (outputPath)
		await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
	process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
	await client.query("ROLLBACK").catch(() => {});
	await client.end();
}
