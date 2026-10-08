import { type FormEvent, useCallback, useState } from "react";
import { authClient } from "../../../../../modules/identity/auth-client";

export function useChangePasswordForm() {
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [pending, setPending] = useState(false);
	const [message, setMessage] = useState("");
	const [messageKind, setMessageKind] = useState<"error" | "success">("error");

	const submit = useCallback(
		async (event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			setMessage("");
			setMessageKind("error");
			if (newPassword !== confirmPassword) {
				setMessage("Passwords do not match.");
				return;
			}
			setPending(true);
			try {
				const result = await authClient.changePassword({
					currentPassword,
					newPassword,
					revokeOtherSessions: true,
				});
				if (result.error) throw new Error(result.error.message);
				setCurrentPassword("");
				setNewPassword("");
				setConfirmPassword("");
				setMessageKind("success");
				setMessage("Password updated. Use it next time you sign in.");
			} catch (error) {
				setMessage(
					error instanceof Error
						? error.message
						: "Could not change your password.",
				);
			} finally {
				setPending(false);
			}
		},
		[currentPassword, newPassword, confirmPassword],
	);

	return {
		currentPassword,
		setCurrentPassword,
		newPassword,
		setNewPassword,
		confirmPassword,
		setConfirmPassword,
		pending,
		message,
		messageKind,
		submit,
	};
}
