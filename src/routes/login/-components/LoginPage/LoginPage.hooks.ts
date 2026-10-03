import { type FormEvent, useCallback, useState } from "react";
import { authClient } from "../../../../modules/identity/auth-client";
import {
	resendVerificationEmail,
	type SocialProvider,
	startSocialSignIn,
} from "../../../../modules/identity/auth-client-actions";

export function useLoginForm(next: string) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [pending, setPending] = useState(false);
	const [needsVerification, setNeedsVerification] = useState(false);
	const [message, setMessage] = useState("");
	const [messageKind, setMessageKind] = useState<"error" | "success">("error");

	const submit = useCallback(
		async (event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			setMessage("");
			setMessageKind("error");
			setPending(true);
			try {
				const result = await authClient.signIn.email({
					email: email.trim(),
					password,
				});
				if (result.error?.code === "EMAIL_NOT_VERIFIED") {
					setNeedsVerification(true);
					setMessage(
						"Verify your email before signing in. We sent a fresh link.",
					);
					return;
				}
				if (result.error) throw new Error(result.error.message);
				window.location.assign(next);
			} catch (error) {
				setMessage(
					error instanceof Error
						? error.message
						: "Something went wrong. Try again.",
				);
			} finally {
				setPending(false);
			}
		},
		[email, password, next],
	);

	const resend = useCallback(async () => {
		setPending(true);
		setMessage("");
		try {
			await resendVerificationEmail(email, next);
			setMessageKind("success");
			setMessage("A new verification link is on its way.");
		} catch (error) {
			setMessageKind("error");
			setMessage(
				error instanceof Error ? error.message : "Could not resend the email.",
			);
		} finally {
			setPending(false);
		}
	}, [email, next]);

	const social = useCallback(
		async (provider: SocialProvider) => {
			setPending(true);
			setMessage("");
			setMessageKind("error");
			try {
				await startSocialSignIn(provider, next);
			} catch (error) {
				setMessage(
					error instanceof Error
						? error.message
						: "Could not start social sign in.",
				);
				setPending(false);
			}
		},
		[next],
	);

	return {
		email,
		setEmail,
		password,
		setPassword,
		pending,
		needsVerification,
		message,
		messageKind,
		submit,
		resend,
		social,
	};
}
