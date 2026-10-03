export async function sendPasswordResetEmail(
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
			subject: "Reset your Tardis password",
			text: `We received a request to reset your Tardis password. Set a new password using this link:\n\n${url}\n\nThis link expires in one hour. If you did not request a reset, you can ignore this email.`,
		}),
	});
	if (!response.ok)
		throw new Error(
			`Resend rejected password reset email (${response.status})`,
		);
}
