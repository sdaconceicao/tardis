import { execFile } from "node:child_process";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { isDeepStrictEqual, promisify } from "node:util";
import { createGunzip } from "node:zlib";
import { config as loadEnv } from "dotenv";
import { Client } from "pg";
import {
	applyCatalogBatch,
	type BatchCounts,
	completeCatalogRun,
	rebuildCatalogClusters,
} from "../modules/places/catalog-import.server.ts";
import { boundaryFile } from "../services/overture/boundary.ts";
import { hostedCapacityReserve } from "../services/overture/capacity.ts";
import { resolveOvertureSyncConfig } from "../services/overture/config.ts";
import { buildExtractSql } from "../services/overture/extract-query.ts";
import {
	loadPinnedPlaceManifest,
	overtureRelease,
} from "../services/overture/manifest.ts";
import { ndjsonLines } from "../services/overture/ndjson.ts";
import {
	type CatalogPlace,
	type ExtractedPlace,
	normalizeOverturePlace,
} from "../services/overture/normalize.ts";
import { regionalExpectedRows } from "../services/overture/regional-profile.ts";
import { resolveCategoryMapping } from "../services/overture/taxonomy.ts";

loadEnv({ path: [".env.local", ".env"] });
const exec = promisify(execFile);
const taxonomyPath = new URL(
	"../../config/overture/taxonomy-2026-09-23.0.csv",
	import.meta.url,
);

async function extract(sql: string): Promise<void> {
	try {
		await exec(
			"duckdb",
			[
				"-c",
				`LOAD httpfs; LOAD spatial; SET threads=2; SET memory_limit='2GB'; ${sql}`,
			],
			{
				maxBuffer: 1_000_000,
			},
		);
	} catch (error) {
		const failure = error as Error & { stderr?: string };
		throw new Error(failure.stderr?.trim() || failure.message);
	}
}

function addCounts(total: BatchCounts, batch: BatchCounts): void {
	total.inserted += batch.inserted;
	total.updated += batch.updated;
	total.unchanged += batch.unchanged;
}

async function withPostgis<T>(
	work: (client: Client) => Promise<T>,
): Promise<T> {
	const client = new Client({ connectionString: process.env.DATABASE_URL });
	client.on("error", (error) => {
		process.stderr.write(`PostGIS connection lost: ${error.message}\n`);
	});
	await client.connect();
	try {
		return await work(client);
	} finally {
		await client.end();
	}
}

async function importAsset(
	client: Client,
	runId: string,
	partition: string,
	path: string,
	batchSize: number,
	scope: "regional-poi" | "neon-free",
	mapping: ReturnType<typeof resolveCategoryMapping>,
	rejectPath: string,
) {
	const input = path.endsWith(".gz")
		? createReadStream(path).pipe(createGunzip())
		: createReadStream(path);
	const lines = ndjsonLines(input);
	const rejects = createWriteStream(rejectPath);
	const counts: BatchCounts = { inserted: 0, updated: 0, unchanged: 0 };
	const reasons: Record<string, number> = {};
	let accepted = 0;
	let seen = 0;
	let batchNumber = 0;
	let batch: CatalogPlace[] = [];
	async function flush() {
		addCounts(
			counts,
			await applyCatalogBatch(client, runId, partition, batchNumber++, batch),
		);
		batch = [];
	}
	try {
		for await (const line of lines) {
			seen++;
			const raw = JSON.parse(line) as ExtractedPlace;
			const normalized = normalizeOverturePlace(raw, scope, mapping);
			if (normalized.value) {
				batch.push(normalized.value);
				accepted++;
			} else {
				const reason = normalized.reject;
				reasons[reason] = (reasons[reason] ?? 0) + 1;
				if (!rejects.write(`${JSON.stringify({ reason, record: raw })}\n`)) {
					await new Promise<void>((done) => rejects.once("drain", done));
				}
			}
			if (seen % batchSize === 0) await flush();
			if (seen % 100_000 === 0)
				process.stderr.write(`${partition}: ${seen} source rows processed\n`);
		}
		if (seen % batchSize !== 0 || seen === 0) await flush();
	} finally {
		await new Promise<void>((done) => rejects.end(done));
	}
	return { seen, accepted, reasons, counts };
}

async function main() {
	const resolved = resolveOvertureSyncConfig(process.env);
	const existing = await withPostgis((client) =>
		client.query(
			"SELECT id, state, resolved_config FROM place_import_runs WHERE release=$1 AND selection_fingerprint=$2",
			[overtureRelease, resolved.selectionFingerprint],
		),
	);
	if (existing.rows[0]?.state === "completed") {
		process.stdout.write(
			"This Overture release and selection are already imported.\n",
		);
		return;
	}
	if (
		existing.rows[0] &&
		!isDeepStrictEqual(existing.rows[0].resolved_config, resolved)
	) {
		throw new Error(
			"Cannot resume with a different resolved import configuration",
		);
	}
	const mapping = resolveCategoryMapping(await readFile(taxonomyPath, "utf8"));
	const manifest = await loadPinnedPlaceManifest();
	const regionalRows =
		resolved.profile === "regional-poi"
			? await regionalExpectedRows(manifest)
			: null;
	const root = resolve(process.env.OVERTURE_ARTIFACT_DIR || ".data/overture");
	const directory = join(root, overtureRelease, resolved.selectionFingerprint);
	await mkdir(directory, { recursive: true });
	const manifestPath = join(directory, "manifest.json");
	const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
	try {
		const frozen = await readFile(manifestPath, "utf8");
		if (frozen !== manifestJson)
			throw new Error("Overture manifest changed during resume");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		await writeFile(manifestPath, manifestJson);
	}
	const boundaryFiles =
		resolved.profile === "neon-free"
			? { us: await boundaryFile(directory, "neon-free") }
			: {
					countries: await boundaryFile(directory, "regional-poi"),
					regions: await boundaryFile(directory, "regional-poi-continents"),
				};
	let expectedRows = regionalRows;
	const hostedReserve =
		resolved.target === "hosted"
			? await hostedCapacityReserve(manifest, resolved)
			: null;
	if (hostedReserve) expectedRows = hostedReserve.sourceRows;
	const runId: string = await withPostgis(async (client) => {
		if (hostedReserve) {
			const size = Number(
				(
					await client.query(
						"SELECT pg_database_size(current_database()) AS bytes",
					)
				).rows[0].bytes,
			);
			if (
				size + hostedReserve.reservedBytes >
				(resolved.limits.databaseStorageBytes ?? 0)
			) {
				throw new Error(
					`Hosted Overture projected database size ${size + hostedReserve.reservedBytes} exceeds the configured budget`,
				);
			}
			process.stderr.write(
				`Hosted Overture capacity check passed: ${hostedReserve.reservedBytes} reserved place bytes, ${size} current database bytes\n`,
			);
		}
		return (
			existing.rows[0]?.id ??
			(
				await client.query(
					`INSERT INTO place_import_runs (release, profile, selection_fingerprint, resolved_config, manifest_url)
			VALUES ($1,$2,$3,$4::jsonb,$5) RETURNING id`,
					[
						overtureRelease,
						resolved.profile,
						resolved.selectionFingerprint,
						JSON.stringify(resolved),
						manifestPath,
					],
				)
			).rows[0].id
		);
	});
	const report = {
		release: overtureRelease,
		profile: resolved.profile,
		assets: manifest.length,
		seen: 0,
		accepted: 0,
		reasons: {} as Record<string, number>,
		counts: { inserted: 0, updated: 0, unchanged: 0 } as BatchCounts,
	};
	for (const asset of manifest) {
		const compressed = join(directory, `${asset.id}.json.gz`);
		const legacy = join(directory, `${asset.id}.json`);
		let output = compressed;
		try {
			await stat(output);
		} catch {
			try {
				await stat(legacy);
				output = legacy;
			} catch {
				const temporary = `${output}.tmp`;
				process.stderr.write(`Extracting ${asset.id} from Overture...\n`);
				await extract(
					buildExtractSql(
						asset.url,
						temporary,
						resolved.profile,
						mapping,
						boundaryFiles,
					),
				);
				await rename(temporary, output);
			}
		}
		const result = await withPostgis((client) =>
			importAsset(
				client,
				runId,
				asset.id,
				output,
				resolved.batchSize,
				resolved.profile,
				mapping,
				join(directory, `${asset.id}.rejects.json`),
			),
		);
		report.seen += result.seen;
		report.accepted += result.accepted;
		addCounts(report.counts, result.counts);
		for (const [reason, count] of Object.entries(result.reasons)) {
			report.reasons[reason] = (report.reasons[reason] ?? 0) + count;
		}
		await writeFile(
			join(directory, "progress.json"),
			`${JSON.stringify(report, null, 2)}\n`,
		);
	}
	if (expectedRows !== null && report.seen !== expectedRows) {
		throw new Error(
			`Incomplete Overture snapshot: read ${report.seen} rows, expected ${expectedRows}`,
		);
	}
	process.stderr.write("Building wide-zoom POI clusters...\n");
	await withPostgis(async (client) => {
		await rebuildCatalogClusters(client, runId);
		await completeCatalogRun(client, runId, manifest.length, report);
	});
	await writeFile(
		join(directory, "report.json"),
		`${JSON.stringify(report, null, 2)}\n`,
	);
	process.stdout.write(
		`Imported ${report.accepted} valid POIs. Report: ${join(directory, "report.json")}\n`,
	);
}

main().catch((error: unknown) => {
	process.stderr.write(
		`${error instanceof Error ? error.message : String(error)}\n`,
	);
	process.exitCode = 1;
});
