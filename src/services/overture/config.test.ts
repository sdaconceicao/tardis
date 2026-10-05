import { describe, expect, it } from "vitest";
import { resolveOvertureSyncConfig } from "./config";

const local = {
	DATABASE_URL: "postgresql://tardis:local@127.0.0.1:5435/tardis",
	OVERTURE_SYNC_PROFILE: "all",
	OVERTURE_DEPLOYMENT_TARGET: "local",
};
const hosted = {
	DATABASE_URL:
		"postgresql://user:secret@ep-small.us-east-2.aws.neon.tech/tardis",
	OVERTURE_SYNC_PROFILE: "neon-free",
	OVERTURE_DEPLOYMENT_TARGET: "hosted",
};

describe("resolveOvertureSyncConfig", () => {
	it("selects the unrestricted local scope regardless of NODE_ENV", () => {
		const config = resolveOvertureSyncConfig({
			...local,
			NODE_ENV: "production",
		});
		expect(config.scope.countries).toBe("all");
		expect(config.scope.categoryGroups).toBe("all");
		expect(config.limits.placesStorageBytes).toBeNull();
		expect(config.selectionFingerprint).toMatch(/^[0-9a-f]{64}$/);
	});

	it("selects the bounded US scope for a hosted database", () => {
		const config = resolveOvertureSyncConfig(hosted);
		expect(config.scope.countries).toEqual(["US"]);
		expect(config.scope.categoryGroups).toEqual([
			"restaurants",
			"parks",
			"museums",
			"landmarks",
			"entertainment",
		]);
		expect(config.limits).toEqual({
			placesStorageBytes: 150_000_000,
			databaseStorageBytes: 350_000_000,
		});
	});

	it("does not infer a profile or target from runtime environment", () => {
		expect(() =>
			resolveOvertureSyncConfig({
				...hosted,
				OVERTURE_SYNC_PROFILE: undefined,
			}),
		).toThrow();
		expect(() =>
			resolveOvertureSyncConfig({
				...hosted,
				OVERTURE_DEPLOYMENT_TARGET: undefined,
			}),
		).toThrow();
	});

	it("refuses a broad import into a remote or Neon database", () => {
		expect(() =>
			resolveOvertureSyncConfig({
				...local,
				DATABASE_URL: hosted.DATABASE_URL,
			}),
		).toThrow(/loopback/);
		expect(() =>
			resolveOvertureSyncConfig({ ...hosted, OVERTURE_SYNC_PROFILE: "all" }),
		).toThrow(/all profile/);
	});

	it("refuses a hosted profile against local PostGIS", () => {
		expect(() =>
			resolveOvertureSyncConfig({
				...hosted,
				DATABASE_URL: local.DATABASE_URL,
			}),
		).toThrow(/remote database/);
	});

	it("accepts smaller hosted limits and rejects a bypass", () => {
		const config = resolveOvertureSyncConfig(hosted, {
			limits: { placesStorageBytes: 100_000_000 },
		});
		expect(config.limits.placesStorageBytes).toBe(100_000_000);
		expect(() =>
			resolveOvertureSyncConfig(hosted, {
				limits: { placesStorageBytes: null },
			}),
		).toThrow(/placesStorageBytes/);
		expect(() =>
			resolveOvertureSyncConfig(hosted, {
				limits: { databaseStorageBytes: 400_000_000 },
			}),
		).toThrow(/databaseStorageBytes/);
		expect(() => resolveOvertureSyncConfig(hosted, { concurrency: 2 })).toThrow(
			/concurrency/,
		);
	});

	it("rejects unknown overrides and invalid database URLs", () => {
		expect(() =>
			resolveOvertureSyncConfig(local, { unexpected: true } as never),
		).toThrow();
		expect(() =>
			resolveOvertureSyncConfig({ ...local, DATABASE_URL: "https://db.test" }),
		).toThrow(/PostgreSQL/);
	});

	it("keeps the selection fingerprint stable across execution-limit changes", () => {
		const first = resolveOvertureSyncConfig(local);
		const second = resolveOvertureSyncConfig(local, { batchSize: 500 });
		expect(second.selectionFingerprint).toBe(first.selectionFingerprint);
	});
});
