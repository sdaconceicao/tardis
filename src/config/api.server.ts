export function allowedOrigins(environment: NodeJS.ProcessEnv = process.env) {
	const values = [
		environment.BETTER_AUTH_URL,
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
