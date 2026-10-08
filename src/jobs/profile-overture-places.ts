import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { overtureProfiles } from "../../config/overture/profiles.ts";
import {
	boundaryFile,
	boundarySources,
} from "../services/overture/boundary.ts";
import {
	collectionUrl,
	fetchPlaceManifest,
	loadPinnedPlaceManifest,
	overtureRelease,
} from "../services/overture/manifest.ts";
import { buildProfileQuery } from "../services/overture/profile-query.ts";
import {
	resolveCategoryMapping,
	taxonomySha256,
} from "../services/overture/taxonomy.ts";

const exec = promisify(execFile);
const taxonomyPath = new URL(
	"../../config/overture/taxonomy-2026-09-23.0.csv",
	import.meta.url,
);

type Options = {
	scope: "regional-poi" | "neon-free";
	smoke: boolean;
	manifestOnly: boolean;
	output?: string;
};

function parseOptions(args: string[]): Options {
	const options: Options = {
		scope: "neon-free",
		smoke: false,
		manifestOnly: false,
	};
	for (let index = 0; index < args.length; index++) {
		const arg = args[index];
		if (
			arg === "--scope" &&
			(args[index + 1] === "regional-poi" || args[index + 1] === "neon-free")
		) {
			options.scope = args[++index] as Options["scope"];
		} else if (arg === "--smoke") {
			options.smoke = true;
		} else if (arg === "--manifest-only") {
			options.manifestOnly = true;
		} else if (arg === "--output" && args[index + 1]) {
			options.output = args[++index];
		} else {
			throw new Error(`Unknown or incomplete option: ${arg}`);
		}
	}
	return options;
}

async function main(): Promise<void> {
	const options = parseOptions(process.argv.slice(2));
	const started = performance.now();
	const manifest = await fetchPlaceManifest();
	const pinned = await loadPinnedPlaceManifest();
	if (JSON.stringify(manifest) !== JSON.stringify(pinned)) {
		throw new Error(
			"Overture STAC manifest differs from the pinned release snapshot",
		);
	}
	const manifestSha256 = createHash("sha256")
		.update(
			JSON.stringify(
				manifest.map(({ id, url, rows, bytes }) => ({ id, url, rows, bytes })),
			),
		)
		.digest("hex");
	const totalRows = manifest.reduce((sum, asset) => sum + asset.rows, 0);
	const sourceBytes = manifest.reduce((sum, asset) => sum + asset.bytes, 0);
	const selectedAssets = options.smoke ? manifest.slice(0, 1) : manifest;
	const base = {
		release: overtureRelease,
		collectionUrl,
		scope: options.scope,
		selectionVersion: overtureProfiles[options.scope].version,
		taxonomySha256,
		manifest: {
			sha256: manifestSha256,
			files: manifest.length,
			rows: totalRows,
			compressedBytes: sourceBytes,
		},
		scanned: {
			files: selectedAssets.length,
			manifestRows: selectedAssets.reduce((sum, asset) => sum + asset.rows, 0),
			compressedBytes: selectedAssets.reduce(
				(sum, asset) => sum + asset.bytes,
				0,
			),
		},
		complete: !options.smoke,
	};
	if (options.manifestOnly) {
		process.stdout.write(
			`${JSON.stringify({ ...base, assets: selectedAssets }, null, 2)}\n`,
		);
		return;
	}
	const mapping = resolveCategoryMapping(await readFile(taxonomyPath, "utf8"));
	const directory = await mkdtemp(join(tmpdir(), "tardis-overture-profile-"));
	try {
		await mkdir(join(directory, "duckdb-tmp"));
		const boundaryFiles =
			options.scope === "neon-free"
				? { us: await boundaryFile(directory, "neon-free") }
				: {
						countries: await boundaryFile(directory, "regional-poi"),
						regions: await boundaryFile(directory, "regional-poi-continents"),
					};
		const query = buildProfileQuery(
			selectedAssets.map((asset) => asset.url),
			options.scope,
			mapping,
			boundaryFiles,
		);
		process.stderr.write(
			`Profiling ${selectedAssets.length}/${manifest.length} Overture files for ${options.scope}...\n`,
		);
		const sql = `LOAD httpfs; LOAD spatial; SET threads=2; SET memory_limit='2GB'; SET temp_directory='${join(directory, "duckdb-tmp")}'; ${query}`;
		let stdout: string;
		try {
			({ stdout } = await exec("duckdb", ["-json", "-c", sql], {
				maxBuffer: 50_000_000,
			}));
		} catch (error) {
			const failure = error as Error & { stderr?: string };
			throw new Error(failure.stderr?.trim() || failure.message);
		}
		const rows: unknown = JSON.parse(stdout);
		if (!Array.isArray(rows))
			throw new Error("Unexpected DuckDB profile result");
		const counts = rows.map((value) => {
			const row = value as Record<string, unknown>;
			return {
				region: String(row.region),
				category: String(row.category),
				status: String(row.status),
				count: Number(row.row_count),
				idNameBytes: Number(row.id_name_bytes ?? 0),
			};
		});
		const accepted = counts
			.filter((row) => row.status === "accepted")
			.reduce((sum, row) => sum + row.count, 0);
		const rejected = counts
			.filter((row) => row.status !== "accepted")
			.reduce((sum, row) => sum + row.count, 0);
		const report = {
			...base,
			boundarySha256:
				options.scope === "neon-free"
					? boundarySources["neon-free"].sha256
					: [
							boundarySources["regional-poi"].sha256,
							boundarySources["regional-poi-continents"].sha256,
						],
			elapsedSeconds: Math.round((performance.now() - started) / 100) / 10,
			accepted,
			rejected,
			// These scenarios are planning estimates only; an actual PostGIS sample must set the hosted gate.
			storageScenarios: {
				bytesAt400PerPlace: accepted * 400,
				bytesAt800PerPlace: accepted * 800,
				placesBudgetBytes:
					overtureProfiles[options.scope].limits.placesStorageBytes,
				measuredInPostgres: false,
			},
			counts,
		};
		const json = `${JSON.stringify(report, null, 2)}\n`;
		if (options.output) {
			await writeFile(options.output, json);
			process.stdout.write(`Profile written to ${options.output}\n`);
		} else {
			process.stdout.write(json);
		}
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
}

main().catch((error: unknown) => {
	process.stderr.write(
		`${error instanceof Error ? error.message : String(error)}\n`,
	);
	process.exitCode = 1;
});
