import type { Client } from "pg";
import { excludedLandmarkTaxonomy } from "../../services/overture/landmark-policy.ts";
import type { CatalogPlace } from "../../services/overture/normalize.ts";

export type BatchCounts = {
	inserted: number;
	updated: number;
	unchanged: number;
};

export async function applyCatalogBatch(
	client: Client,
	runId: string,
	partition: string,
	batchNumber: number,
	records: CatalogPlace[],
): Promise<BatchCounts> {
	await client.query("BEGIN");
	try {
		const run = await client.query(
			"SELECT state FROM place_import_runs WHERE id=$1 FOR UPDATE",
			[runId],
		);
		if (run.rows[0]?.state !== "running")
			throw new Error("Catalog import run is not active");
		const previous = await client.query(
			"SELECT state, counts FROM place_import_batches WHERE run_id=$1 AND partition=$2 AND batch_number=$3",
			[runId, partition, batchNumber],
		);
		if (previous.rows[0]?.state === "completed") {
			await client.query("COMMIT");
			return previous.rows[0].counts as BatchCounts;
		}
		await client.query(
			`INSERT INTO place_import_batches (run_id, partition, batch_number, state)
			VALUES ($1,$2,$3,'running') ON CONFLICT (run_id, partition, batch_number)
			DO UPDATE SET state='running'`,
			[runId, partition, batchNumber],
		);
		const ids = records.map((record) => record.externalId);
		const current = ids.length
			? await client.query(
					`SELECT source.external_id, source.place_id, source.content_hash, source.state,
						place.name, place.timezone, place.management_kind,
						location.label, location.address, location.latitude, location.longitude
					FROM place_sources source
					JOIN places place ON place.id=source.place_id
					JOIN locations location ON location.id=place.location_id
					WHERE source.provider='overture' AND source.external_id=ANY($1::text[])`,
					[ids],
				)
			: { rows: [] };
		const byId = new Map(
			current.rows.map((row) => [row.external_id as string, row]),
		);
		const counts: BatchCounts = { inserted: 0, updated: 0, unchanged: 0 };
		const unchangedIds: string[] = [];
		const newRecords: CatalogPlace[] = [];
		for (const record of records) {
			const existing = byId.get(record.externalId);
			if (existing && existing.management_kind !== "catalog") {
				throw new Error(
					`Overture identity belongs to a non-catalog place: ${record.externalId}`,
				);
			}
			if (
				existing &&
				Buffer.from(existing.content_hash).equals(record.contentHash) &&
				existing.state === "active"
			) {
				unchangedIds.push(record.externalId);
				counts.unchanged++;
				continue;
			}
			if (!existing) {
				newRecords.push(record);
				counts.inserted++;
				continue;
			}
			const sameLocation =
				existing.label === record.name &&
				(existing.address ?? null) === record.address &&
				Number(existing.latitude) === record.latitude &&
				Number(existing.longitude) === record.longitude;
			let locationId: string | undefined;
			if (!sameLocation) {
				const location = await client.query(
					`INSERT INTO locations (label, address, latitude, longitude)
					VALUES ($1,$2,$3,$4) RETURNING id`,
					[record.name, record.address, record.latitude, record.longitude],
				);
				locationId = location.rows[0].id;
			}
			await client.query(
				`UPDATE places SET name=$1, timezone=$2,
				location_id=COALESCE($3::uuid, location_id), updated_at=now()
				WHERE id=$4`,
				[record.name, record.timezone, locationId ?? null, existing.place_id],
			);
			await client.query(
				`UPDATE place_sources SET applied_run_id=$1, content_hash=$2, state='active',
				category=$3, taxonomy_primary=$4, operating_status=$5, confidence=$6,
				updated_at=now() WHERE provider='overture' AND external_id=$7`,
				[
					runId,
					record.contentHash,
					record.category,
					record.taxonomyPrimary,
					record.operatingStatus,
					record.confidence,
					record.externalId,
				],
			);
			counts.updated++;
		}
		if (unchangedIds.length) {
			await client.query(
				"UPDATE place_sources SET applied_run_id=$1 WHERE provider='overture' AND external_id=ANY($2::text[])",
				[runId, unchangedIds],
			);
		}
		if (newRecords.length) {
			const rows = newRecords.map((record) => ({
				external_id: record.externalId,
				name: record.name,
				address: record.address,
				latitude: record.latitude,
				longitude: record.longitude,
				timezone: record.timezone,
				category: record.category,
				taxonomy_primary: record.taxonomyPrimary,
				operating_status: record.operatingStatus,
				confidence: record.confidence,
				content_hash: record.contentHash.toString("hex"),
			}));
			await client.query(
				`WITH input AS MATERIALIZED (
					SELECT gen_random_uuid() AS location_id, gen_random_uuid() AS place_id, row.*
					FROM jsonb_to_recordset($2::jsonb) AS row(
						external_id text, name text, address text,
						latitude double precision, longitude double precision,
						timezone text, category text, taxonomy_primary text,
						operating_status text, confidence double precision, content_hash text
					)
				), inserted_locations AS (
					INSERT INTO locations (id, label, address, latitude, longitude)
					SELECT location_id, name, address, latitude, longitude FROM input
					RETURNING id
				), inserted_places AS (
					INSERT INTO places (id, name, management_kind, visibility, location_id, timezone)
					SELECT place_id, name, 'catalog', 'public', location_id, timezone
					FROM input JOIN inserted_locations ON inserted_locations.id=input.location_id
					RETURNING id
				)
				INSERT INTO place_sources (place_id, applied_run_id, provider, external_id,
					content_hash, state, category, taxonomy_primary, operating_status,
					confidence, attribution)
				SELECT input.place_id, $1::uuid, 'overture', external_id,
					decode(content_hash, 'hex'), 'active', category, taxonomy_primary,
					operating_status, confidence, 'Overture Maps Foundation'
				FROM input JOIN inserted_places ON inserted_places.id=input.place_id`,
				[runId, JSON.stringify(rows)],
			);
		}
		await client.query(
			`UPDATE place_import_batches SET state='completed', counts=$1::jsonb, updated_at=now()
			WHERE run_id=$2 AND partition=$3 AND batch_number=$4`,
			[JSON.stringify(counts), runId, partition, batchNumber],
		);
		await client.query("COMMIT");
		return counts;
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	}
}

export async function rebuildCatalogClusters(
	client: Client,
	runId: string,
): Promise<void> {
	await client.query("BEGIN");
	try {
		await client.query("DELETE FROM place_cluster_cells WHERE run_id=$1", [
			runId,
		]);
		await client.query(
			`INSERT INTO place_cluster_cells (
				run_id, category, cell_x, cell_y, place_count,
				latitude_sum, longitude_sum, west, east, south, north
			)
			SELECT $1::uuid, source.category,
				floor((location.longitude + 180) / 0.703125)::integer,
				floor((location.latitude + 90) / 0.703125)::integer,
				count(*)::integer,
				sum(location.latitude)::double precision,
				sum(location.longitude)::double precision,
				min(location.longitude), max(location.longitude),
				min(location.latitude), max(location.latitude)
			FROM place_sources source
			JOIN places place ON place.id=source.place_id
			JOIN locations location ON location.id=place.location_id
			WHERE source.applied_run_id=$1
				AND source.state='active'
				AND source.category IS NOT NULL
				AND (source.category <> 'landmarks' OR (source.taxonomy_primary IS NOT NULL AND source.taxonomy_primary <> $2))
				AND (source.operating_status IS NULL OR source.operating_status='open')
				AND place.management_kind='catalog'
				AND place.visibility='public'
			GROUP BY 1, 2, 3, 4`,
			[runId, excludedLandmarkTaxonomy],
		);
		await client.query("COMMIT");
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	}
}

export async function completeCatalogRun(
	client: Client,
	runId: string,
	expectedPartitions: number,
	report: Record<string, unknown>,
): Promise<void> {
	await client.query("BEGIN");
	try {
		const run = await client.query(
			"SELECT state FROM place_import_runs WHERE id=$1 FOR UPDATE",
			[runId],
		);
		if (run.rows[0]?.state !== "running")
			throw new Error("Catalog import run is not active");
		const batches = await client.query(
			`SELECT count(DISTINCT partition)::integer AS partitions,
				count(*) FILTER (WHERE state <> 'completed')::integer AS incomplete
			FROM place_import_batches WHERE run_id=$1`,
			[runId],
		);
		if (
			batches.rows[0].partitions !== expectedPartitions ||
			batches.rows[0].incomplete !== 0 ||
			!Number.isFinite(Number(report.accepted)) ||
			Number(report.accepted) <= 0
		)
			throw new Error(
				"Cannot complete an incomplete or empty catalog snapshot",
			);
		await client.query(
			`UPDATE place_sources SET state='out_of_scope', updated_at=now()
			WHERE provider='overture' AND state='active' AND applied_run_id<>$1`,
			[runId],
		);
		await client.query(
			`UPDATE place_import_runs SET state='completed', completed_at=now(),
			report=$2::jsonb, updated_at=now() WHERE id=$1 AND state='running'`,
			[runId, JSON.stringify(report)],
		);
		await client.query("COMMIT");
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	}
}
