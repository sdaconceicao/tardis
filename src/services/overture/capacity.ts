import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { overtureProfiles } from "../../../config/overture/profiles.ts";
import type { OvertureSyncConfig } from "./config.ts";
import { overtureRelease, type PlaceAsset } from "./manifest.ts";
import { taxonomySha256 } from "./taxonomy.ts";

const profileSchema = z.object({
	release: z.string(),
	selectionVersion: z.string(),
	taxonomySha256: z.string(),
	boundarySha256: z.string(),
	complete: z.boolean(),
	accepted: z.number().int().positive(),
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
	derivedFrom: z.object({ sha256: z.string() }),
	counts: z.array(
		z.object({
			region: z.string(),
			category: z.string(),
			status: z.string(),
			count: z.number().int().nonnegative(),
		}),
	),
});

const sampleSchema = z.object({
	release: z.string(),
	selectionVersion: z.string(),
	profileRows: z.number().int().positive(),
	sampleRows: z.number().int().positive(),
	sampleSha256: z.string().regex(/^[0-9a-f]{64}$/),
	incrementalBytes: z.number().int().positive(),
	bytesPerPlace: z.number().positive(),
	projectedPlacesBytes: z.number().int().positive(),
	placesBudgetBytes: z.number().int().positive(),
});

const boundarySha256 =
	"9cbfe171dad1555e11770c981d8f4db9e687a65c86f5bdae684eeb487e2e9b80";
const sourceProfileUrl = new URL(
	"../../../config/overture/profile-us-2026-09-23.1-five-groups.json",
	import.meta.url,
);
const profileUrl = new URL(
	"../../../config/overture/profile-us-2026-09-23.1-poi.json",
	import.meta.url,
);
const sampleUrl = new URL(
	"../../../config/overture/storage-measure-2026-09-23.1-poi.json",
	import.meta.url,
);

export async function hostedCapacityReserve(
	manifest: PlaceAsset[],
	config: OvertureSyncConfig,
): Promise<{ reservedBytes: number; sourceRows: number }> {
	if (config.profile !== "neon-free" || config.target !== "hosted") {
		throw new Error("Hosted capacity report applies only to neon-free/hosted");
	}
	const [sourceBytes, profileBytes, sampleBytes] = await Promise.all([
		readFile(sourceProfileUrl),
		readFile(profileUrl),
		readFile(sampleUrl),
	]);
	const profile = profileSchema.parse(
		JSON.parse(profileBytes.toString("utf8")),
	);
	const sample = sampleSchema.parse(JSON.parse(sampleBytes.toString("utf8")));
	const sourceHash = createHash("sha256").update(sourceBytes).digest("hex");
	const manifestHash = createHash("sha256")
		.update(
			JSON.stringify(
				manifest.map(({ id, url, rows, bytes }) => ({ id, url, rows, bytes })),
			),
		)
		.digest("hex");
	const totalRows = manifest.reduce((total, asset) => total + asset.rows, 0);
	const accepted = profile.counts
		.filter((row) => row.status === "accepted")
		.reduce((total, row) => total + row.count, 0);
	const rejected = profile.counts
		.filter((row) => row.status !== "accepted")
		.reduce((total, row) => total + row.count, 0);
	if (
		profile.release !== overtureRelease ||
		sample.release !== overtureRelease ||
		profile.selectionVersion !== config.version ||
		sample.selectionVersion !== config.version ||
		profile.taxonomySha256 !== taxonomySha256 ||
		profile.boundarySha256 !== boundarySha256 ||
		profile.derivedFrom.sha256 !== sourceHash ||
		profile.manifest.sha256 !== manifestHash ||
		profile.manifest.files !== manifest.length ||
		profile.manifest.rows !== totalRows ||
		!profile.complete ||
		profile.scanned.files !== manifest.length ||
		profile.scanned.manifestRows !== totalRows ||
		profile.accepted !== accepted ||
		profile.rejected !== rejected ||
		profile.counts.some(
			(row) => row.category !== "museums" && row.category !== "entertainment",
		) ||
		sample.profileRows !== profile.accepted ||
		sample.sampleRows < 10_000 ||
		sample.placesBudgetBytes !==
			overtureProfiles["neon-free"].limits.placesStorageBytes ||
		Math.abs(
			sample.incrementalBytes / sample.sampleRows - sample.bytesPerPlace,
		) > 0.001 ||
		sample.projectedPlacesBytes !==
			Math.ceil(sample.bytesPerPlace * profile.accepted)
	) {
		throw new Error(
			"Hosted Overture capacity report does not match this release and selection",
		);
	}
	const reserve = Math.ceil(sample.projectedPlacesBytes * 1.2);
	if (reserve > (config.limits.placesStorageBytes ?? 0)) {
		throw new Error(
			`Hosted Overture places reserve ${reserve} exceeds the configured budget`,
		);
	}
	return {
		reservedBytes: reserve,
		sourceRows: profile.accepted + profile.rejected,
	};
}
