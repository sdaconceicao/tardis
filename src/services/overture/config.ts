import { createHash } from "node:crypto";
import { z } from "zod";
import { overtureProfiles } from "../../../config/overture/profiles.ts";

const profileNameSchema = z.enum(["regional-poi", "neon-free"]);
const targetSchema = z.enum(["local", "hosted"]);
const categoryGroupSchema = z.enum([
	"restaurants",
	"parks",
	"museums",
	"landmarks",
	"entertainment",
]);

const scopeSchema = z.strictObject({
	countries: z.union([
		z.literal("all"),
		z.array(z.string().regex(/^[A-Z]{2}$/)).min(1),
	]),
	regions: z
		.array(z.enum(["North America", "Europe"]))
		.min(1)
		.nullable(),
	boundarySet: z.string().min(1).nullable(),
	categoryGroups: z.union([
		z.literal("all"),
		z.array(categoryGroupSchema).min(1),
	]),
	exclusionSet: z.string().min(1).nullable(),
});

const configSchema = z.strictObject({
	profile: profileNameSchema,
	target: targetSchema,
	version: z.string().min(1),
	scope: scopeSchema,
	limits: z.strictObject({
		placesStorageBytes: z.number().int().positive().nullable(),
		databaseStorageBytes: z.number().int().positive().nullable(),
	}),
	batchSize: z.number().int().min(1).max(10_000),
	concurrency: z.number().int().min(1).max(4),
});

const overrideSchema = z.strictObject({
	batchSize: z.number().int().min(1).max(10_000).optional(),
	concurrency: z.number().int().min(1).max(4).optional(),
	limits: z
		.strictObject({
			placesStorageBytes: z.number().int().positive().nullable().optional(),
			databaseStorageBytes: z.number().int().positive().nullable().optional(),
		})
		.optional(),
});

export type OvertureSyncConfig = z.infer<typeof configSchema> & {
	selectionFingerprint: string;
};
export type OvertureSyncOverrides = z.input<typeof overrideSchema>;

function databaseHost(databaseUrl: string): string {
	const url = new URL(databaseUrl);
	if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
		throw new Error("DATABASE_URL must be a PostgreSQL URL");
	}
	return url.hostname.toLowerCase();
}

function isLocalHost(host: string): boolean {
	return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

function isNeonHost(host: string): boolean {
	return host === "neon.tech" || host.endsWith(".neon.tech");
}

export function resolveOvertureSyncConfig(
	environment: NodeJS.ProcessEnv,
	overrides: OvertureSyncOverrides = {},
): OvertureSyncConfig {
	const profile = profileNameSchema.parse(environment.OVERTURE_SYNC_PROFILE);
	const target = targetSchema.parse(environment.OVERTURE_DEPLOYMENT_TARGET);
	const host = databaseHost(z.string().min(1).parse(environment.DATABASE_URL));
	const localHost = isLocalHost(host);
	if (target === "local" && !localHost) {
		throw new Error("Local Overture imports require a loopback database host");
	}
	if (target === "hosted" && localHost) {
		throw new Error("Hosted Overture imports require a remote database host");
	}
	if (profile === "regional-poi" && (target !== "local" || isNeonHost(host))) {
		throw new Error("The regional-poi profile can only target local PostGIS");
	}
	if (target === "hosted" && profile !== "neon-free") {
		throw new Error("Hosted Overture imports require the neon-free profile");
	}
	if (target === "local" && profile !== "regional-poi") {
		throw new Error("Local Overture imports require the regional-poi profile");
	}

	const requested = overrideSchema.parse(overrides);
	const builtIn = overtureProfiles[profile];
	const config = configSchema.parse({
		...builtIn,
		profile,
		target,
		batchSize: requested.batchSize ?? builtIn.batchSize,
		concurrency: requested.concurrency ?? builtIn.concurrency,
		limits: { ...builtIn.limits, ...requested.limits },
	});
	if (target === "hosted") {
		for (const key of ["placesStorageBytes", "databaseStorageBytes"] as const) {
			const ceiling = overtureProfiles["neon-free"].limits[key];
			const value = config.limits[key];
			if (value === null || value > ceiling) {
				throw new Error(`Hosted Overture ${key} cannot exceed ${ceiling}`);
			}
		}
		if (config.concurrency > overtureProfiles["neon-free"].concurrency) {
			throw new Error("Hosted Overture concurrency cannot exceed 1");
		}
	}

	const selectionFingerprint = createHash("sha256")
		.update(JSON.stringify({ version: config.version, scope: config.scope }))
		.digest("hex");
	return { ...config, selectionFingerprint };
}
