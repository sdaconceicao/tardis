import { config } from "dotenv";
import { resolveOvertureSyncConfig } from "../services/overture/config.ts";

config({ path: [".env.local", ".env"] });

const resolved = resolveOvertureSyncConfig(process.env);
process.stdout.write(
	`${JSON.stringify(
		{
			profile: resolved.profile,
			target: resolved.target,
			version: resolved.version,
			scope: resolved.scope,
			limits: resolved.limits,
			batchSize: resolved.batchSize,
			concurrency: resolved.concurrency,
			selectionFingerprint: resolved.selectionFingerprint,
		},
		null,
		2,
	)}\n`,
);
