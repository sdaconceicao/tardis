import { type FormEvent, useCallback, useState } from "react";
import { authClient } from "../../../../modules/identity/auth-client";
import {
	resendVerificationEmail,
	type SocialProvider,
	startSocialSignIn,
} from "../../../../modules/identity/auth-client-actions";
import { verificationCallbackURL } from "../../../../modules/identity/auth-redirect";

export function useSignupForm(next: string) {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [pending, setPending] = useState(false);
	const [sent, setSent] = useState(false);
	const [message, setMessage] = useState("");
	const [messageKind, setMessageKind] = useState<"error" | "success">("error");

	const submit = useCallback(
		async (event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			setMessage("");
			setMessageKind("error");
			if (password !== confirmPassword) {
				setMessage("Passwords do not match.");
				return;
			}
			setPending(true);
			try {
				const result = await authClient.signUp.email({
					name: name.trim(),
					email: email.trim(),
					password,
					callbackURL: verificationCallbackURL(next),
				});
				if (result.error) throw new Error(result.error.message);
				setSent(true);
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
		[name, email, password, confirmPassword, next],
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
		name,
		setName,
		email,
		setEmail,
		password,
		setPassword,
		confirmPassword,
		setConfirmPassword,
		pending,
		sent,
		message,
		messageKind,
		submit,
		resend,
		social,
	};
}
