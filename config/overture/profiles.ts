export const overtureProfiles = {
	"regional-poi": {
		version: "2026-09-23.1-v1",
		scope: {
			countries: "all",
			regions: ["North America", "Europe"],
			boundarySet: "natural-earth-north-america-europe-50m-v1",
			categoryGroups: [
				"restaurants",
				"parks",
				"museums",
				"landmarks",
				"entertainment",
			],
			exclusionSet: "places-of-interest-exclusions-v1",
		},
		limits: {
			placesStorageBytes: null,
			databaseStorageBytes: null,
		},
		batchSize: 1000,
		concurrency: 1,
	},
	"neon-free": {
		version: "2026-09-23.1-v2",
		scope: {
			countries: ["US"],
			regions: null,
			boundarySet: "us-50-states-dc-v1",
			categoryGroups: ["museums", "entertainment"],
			exclusionSet: "places-of-interest-exclusions-v1",
		},
		limits: {
			placesStorageBytes: 150_000_000,
			databaseStorageBytes: 350_000_000,
		},
		batchSize: 1000,
		concurrency: 1,
	},
} as const;
