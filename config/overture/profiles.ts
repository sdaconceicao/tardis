export const overtureProfiles = {
	all: {
		version: "2026-09-23.0",
		scope: {
			countries: "all",
			boundarySet: null,
			categoryGroups: "all",
			exclusionSet: null,
		},
		limits: {
			placesStorageBytes: null,
			databaseStorageBytes: null,
		},
		batchSize: 1000,
		concurrency: 1,
	},
	"neon-free": {
		version: "2026-09-23.0",
		scope: {
			countries: ["US"],
			boundarySet: "us-50-states-dc-v1",
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
			placesStorageBytes: 150_000_000,
			databaseStorageBytes: 350_000_000,
		},
		batchSize: 1000,
		concurrency: 1,
	},
} as const;
