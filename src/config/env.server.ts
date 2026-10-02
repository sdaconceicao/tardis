import { z } from "zod";

const emptyStringToUndefined = (value: unknown) =>
	value === "" ? undefined : value;

const optionalUrl = z.preprocess(emptyStringToUndefined, z.url().optional());
const optionalSecret = z.preprocess(
	emptyStringToUndefined,
	z.string().min(1).optional(),
);

const serverEnvSchema = z.object({
	DATABASE_URL: z.string().min(1),
	BETTER_AUTH_URL: optionalUrl,
	BETTER_AUTH_SECRET: z.preprocess(
		emptyStringToUndefined,
		z.string().min(32).optional(),
	),
	OPENROUTESERVICE_API_KEY: optionalSecret,
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getServerEnv(
	environment: NodeJS.ProcessEnv = process.env,
): ServerEnv {
	return serverEnvSchema.parse(environment);
}
