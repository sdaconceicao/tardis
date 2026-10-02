export function safeAuthDestination(search: string): string {
	const requested = new URLSearchParams(search).get("next");
	if (
		!requested?.startsWith("/") ||
		requested.startsWith("//") ||
		requested.includes("\\")
	) {
		return "/my-events";
	}
	return requested;
}

export function verificationCallbackURL(next: string): string {
	return `/login?verified=1&next=${encodeURIComponent(next)}`;
}
