export function resolveAuthBaseUrl(
	environment: NodeJS.ProcessEnv = process.env,
) {
	if (environment.BETTER_AUTH_URL) return environment.BETTER_AUTH_URL;
	if (
		environment.VERCEL_ENV === "production" &&
		environment.VERCEL_PROJECT_PRODUCTION_URL
	)
		return `https://${environment.VERCEL_PROJECT_PRODUCTION_URL}`;
	if (environment.VERCEL_BRANCH_URL)
		return `https://${environment.VERCEL_BRANCH_URL}`;
	return undefined;
}

export function allowedOrigins(environment: NodeJS.ProcessEnv = process.env) {
	const values = [
		resolveAuthBaseUrl(environment),
		environment.VERCEL_URL ? `https://${environment.VERCEL_URL}` : undefined,
		...(environment.API_ALLOWED_ORIGINS ?? "").split(","),
	];
	return [
		...new Set(
			values
				.filter((value): value is string => Boolean(value?.trim()))
				.map((value) => {
					const url = new URL(value.trim());
					if (
						!["http:", "https:"].includes(url.protocol) ||
						url.username ||
						url.password ||
						url.search ||
						url.hash ||
						url.pathname !== "/"
					)
						throw new Error(
							"API origins must be absolute HTTP(S) origins without paths or credentials",
						);
					return url.origin;
				}),
		),
	];
}
