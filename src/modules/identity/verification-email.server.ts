export async function sendVerificationEmail(
	config: { apiKey: string; from: string },
	to: string,
	url: string,
	fetcher: typeof fetch = fetch,
) {
	const response = await fetcher("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${config.apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from: config.from,
			to: [to],
			subject: "Verify your Tardis email",
			text: `Welcome to Tardis. Verify your email address by visiting this link:\n\n${url}\n\nThis link expires in one hour.`,
		}),
	});
	if (!response.ok)
		throw new Error(`Resend rejected verification email (${response.status})`);
}
