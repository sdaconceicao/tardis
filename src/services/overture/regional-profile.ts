import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { overtureProfiles } from "../../../config/overture/profiles.ts";
import { boundarySources } from "./boundary.ts";
import { overtureRelease, type PlaceAsset } from "./manifest.ts";
import { taxonomySha256 } from "./taxonomy.ts";

const reportUrl = new URL(
	"../../../config/overture/profile-regional-2026-09-23.1-poi.json",
	import.meta.url,
);
const schema = z.object({
	release: z.string(),
	scope: z.string(),
	selectionVersion: z.string(),
	taxonomySha256: z.string(),
	boundarySha256: z.tuple([z.string(), z.string()]),
	complete: z.boolean(),
	accepted: z.number().int().nonnegative(),
	rejected: z.number().int().nonnegative(),
	manifest: z.object({
		sha256: z.string(),
		files: z.number().int().positive(),
		rows: z.number().int().positive(),
	}),
	scanned: z.object({
		files: z.number().int().positive(),
		manifestRows: z.number().int().positive(),
	}),
	counts: z.array(
		z.object({
			region: z.enum(["North America", "Europe"]),
			category: z.enum([
				"restaurants",
				"parks",
				"museums",
				"landmarks",
				"entertainment",
			]),
			status: z.string(),
			count: z.number().int().nonnegative(),
		}),
	),
});

export async function regionalExpectedRows(
	manifest: PlaceAsset[],
): Promise<number> {
	const report = schema.parse(JSON.parse(await readFile(reportUrl, "utf8")));
	const manifestHash = createHash("sha256")
		.update(
			JSON.stringify(
				manifest.map(({ id, url, rows, bytes }) => ({ id, url, rows, bytes })),
			),
		)
		.digest("hex");
	const sourceRows = manifest.reduce((total, asset) => total + asset.rows, 0);
	const countedRows = report.counts.reduce(
		(total, row) => total + row.count,
		0,
	);
	if (
		report.release !== overtureRelease ||
		report.scope !== "regional-poi" ||
		report.selectionVersion !== overtureProfiles["regional-poi"].version ||
		report.taxonomySha256 !== taxonomySha256 ||
		report.boundarySha256[0] !== boundarySources["regional-poi"].sha256 ||
		report.boundarySha256[1] !==
			boundarySources["regional-poi-continents"].sha256 ||
		!report.complete ||
		report.manifest.sha256 !== manifestHash ||
		report.manifest.files !== manifest.length ||
		report.manifest.rows !== sourceRows ||
		report.scanned.files !== manifest.length ||
		report.scanned.manifestRows !== sourceRows ||
		report.accepted + report.rejected !== countedRows ||
		countedRows <= 0
	) {
		throw new Error("Regional Overture profile does not match this selection");
	}
	return countedRows;
}
