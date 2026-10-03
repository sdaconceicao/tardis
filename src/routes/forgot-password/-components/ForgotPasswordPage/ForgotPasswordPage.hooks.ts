import { type FormEvent, useCallback, useState } from "react";
import { authClient } from "../../../../modules/identity/auth-client";
import { passwordResetURL } from "../../../../modules/identity/auth-redirect";

export function useForgotPasswordForm(next: string) {
	const [email, setEmail] = useState("");
	const [pending, setPending] = useState(false);
	const [sent, setSent] = useState(false);
	const [error, setError] = useState("");

	const submit = useCallback(
		async (event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			setPending(true);
			setError("");
			try {
				const result = await authClient.requestPasswordReset({
					email: email.trim(),
					redirectTo: passwordResetURL(next),
				});
				if (result.error) throw new Error(result.error.message);
				setSent(true);
			} catch (cause) {
				setError(
					cause instanceof Error
						? cause.message
						: "Could not send the reset link. Try again.",
				);
			} finally {
				setPending(false);
			}
		},
		[email, next],
	);

	return { email, setEmail, pending, sent, error, submit };
}
