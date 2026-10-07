import { config as loadEnv } from "dotenv";
import { Client } from "pg";
import { rebuildCatalogClusters } from "../modules/places/catalog-import.server.ts";
import { excludedLandmarkTaxonomy } from "../services/overture/landmark-policy.ts";

loadEnv({ path: [".env.local", ".env"] });

async function main(): Promise<void> {
	const url = new URL(process.env.DATABASE_URL ?? "");
	if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
		throw new Error("Landmark curation only runs against local PostGIS");
	}
	const client = new Client({ connectionString: url.toString() });
	await client.connect();
	try {
		const runs = await client.query<{ id: string }>(
			`SELECT id FROM place_import_runs
			WHERE profile='regional-poi' AND state='completed'
			ORDER BY completed_at DESC LIMIT 1`,
		);
		const runId = runs.rows[0]?.id;
		if (!runId) throw new Error("No completed regional POI import found");
		const result = await client.query(
			`UPDATE place_sources SET state='out_of_scope', updated_at=now()
			WHERE applied_run_id=$1 AND state='active' AND category='landmarks'
				AND (taxonomy_primary IS NULL OR taxonomy_primary=$2)`,
			[runId, excludedLandmarkTaxonomy],
		);
		await rebuildCatalogClusters(client, runId);
		process.stdout.write(
			`Retired ${result.rowCount ?? 0} generic landmark sources; rebuilt map clusters.\n`,
		);
	} finally {
		await client.end();
	}
}

main().catch((error: unknown) => {
	process.stderr.write(
		`${error instanceof Error ? error.message : String(error)}\n`,
	);
	process.exitCode = 1;
});
