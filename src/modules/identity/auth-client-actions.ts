import { authClient } from "./auth-client";
import { verificationCallbackURL } from "./auth-redirect";

export type SocialProvider = "google" | "facebook";

export async function resendVerificationEmail(email: string, next: string) {
	const result = await authClient.sendVerificationEmail({
		email: email.trim(),
		callbackURL: verificationCallbackURL(next),
	});
	if (result.error) throw new Error(result.error.message);
}

export async function startSocialSignIn(
	provider: SocialProvider,
	next: string,
) {
	const result = await authClient.signIn.social({
		provider,
		callbackURL: next,
		errorCallbackURL: "/login",
	});
	if (result.error) throw new Error(result.error.message);
}
