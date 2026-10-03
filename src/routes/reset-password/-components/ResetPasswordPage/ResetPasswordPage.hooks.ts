import { type FormEvent, useCallback, useState } from "react";
import { authClient } from "../../../../modules/identity/auth-client";

export function useResetPasswordForm(token: string | null) {
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [pending, setPending] = useState(false);
	const [complete, setComplete] = useState(false);
	const [invalidToken, setInvalidToken] = useState(false);
	const [error, setError] = useState("");

	const submit = useCallback(
		async (event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			setError("");
			if (password !== confirmPassword) {
				setError("Passwords do not match.");
				return;
			}
			if (!token) {
				setError("This reset link is invalid or expired. Request a new one.");
				return;
			}
			setPending(true);
			try {
				const result = await authClient.resetPassword({
					newPassword: password,
					token,
				});
				if (result.error?.code === "INVALID_TOKEN") {
					setInvalidToken(true);
					return;
				}
				if (result.error) throw new Error(result.error.message);
				setComplete(true);
				setPassword("");
				setConfirmPassword("");
			} catch (cause) {
				setError(
					cause instanceof Error
						? cause.message
						: "Could not reset your password. Request a new link and try again.",
				);
			} finally {
				setPending(false);
			}
		},
		[password, confirmPassword, token],
	);

	return {
		password,
		setPassword,
		confirmPassword,
		setConfirmPassword,
		pending,
		complete,
		invalidToken,
		error,
		submit,
	};
}
