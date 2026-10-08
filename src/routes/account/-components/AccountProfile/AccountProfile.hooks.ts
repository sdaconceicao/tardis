import { type FormEvent, useCallback, useState } from "react";
import { authClient } from "../../../../modules/identity/auth-client";

export function useAccountProfile(initialName: string) {
	const [name, setName] = useState(initialName);
	const [savedName, setSavedName] = useState(initialName);
	const [pending, setPending] = useState(false);
	const [message, setMessage] = useState("");
	const [messageKind, setMessageKind] = useState<"error" | "success">(
		"success",
	);

	const saveName = useCallback(
		async (event: FormEvent<HTMLFormElement>) => {
			event.preventDefault();
			const nextName = name.trim();
			setMessage("");
			if (!nextName) {
				setMessageKind("error");
				setMessage("Enter a name.");
				return;
			}
			setPending(true);
			try {
				const result = await authClient.updateUser({ name: nextName });
				if (result.error) throw new Error(result.error.message);
				setName(nextName);
				setSavedName(nextName);
				setMessageKind("success");
				setMessage("Profile updated.");
			} catch (error) {
				setMessageKind("error");
				setMessage(
					error instanceof Error
						? error.message
						: "Could not update your name.",
				);
			} finally {
				setPending(false);
			}
		},
		[name],
	);

	return {
		name,
		setName,
		pending,
		message,
		messageKind,
		canSave: name.trim() !== savedName.trim(),
		saveName,
	};
}
