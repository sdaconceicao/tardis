import { Alert, Button, Form, Password, Skeleton } from "@code-x/lago";
import { type FormEvent, useState } from "react";
import { AppLink } from "../../../../../components/AppLink/AppLink";
import {
	authClient,
	useSession,
} from "../../../../../modules/identity/auth-client";
import css from "./ChangePasswordPage.module.css";

export function ChangePasswordPage() {
	const { data: session, isPending, error: sessionError } = useSession();
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [pending, setPending] = useState(false);
	const [message, setMessage] = useState("");
	const [messageKind, setMessageKind] = useState<"error" | "success">("error");

	async function submit(event: FormEvent<HTMLFormElement>) {
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
	}

	return (
		<section className={css.page}>
			<p className={css.eyebrow}>Account security</p>
			<h1>Change password</h1>
			{isPending ? (
				<Skeleton variant="line" height={48} label="Loading account" />
			) : sessionError ? (
				<Alert variant="error" role="alert">
					<Alert.Body>
						Could not load your account. Refresh and try again.
					</Alert.Body>
				</Alert>
			) : !session?.user ? (
				<p>
					Sign in to change your password.{" "}
					<AppLink to="/login" search={{ next: "/account/password" }}>
						Sign in
					</AppLink>
				</p>
			) : (
				<div className={css.panel}>
					<p>Enter your current password, then choose a new one.</p>
					<Form className={css.form} onSubmit={submit}>
						<Password
							label="Current password"
							name="current-password"
							autoComplete="current-password"
							value={currentPassword}
							onChange={setCurrentPassword}
							isRequired
							isDisabled={pending}
						/>
						<Password
							label="New password"
							name="new-password"
							autoComplete="new-password"
							value={newPassword}
							onChange={setNewPassword}
							minLength={8}
							isRequired
							isDisabled={pending}
						/>
						<Password
							label="Confirm new password"
							name="confirm-password"
							autoComplete="new-password"
							value={confirmPassword}
							onChange={setConfirmPassword}
							minLength={8}
							isRequired
							isDisabled={pending}
						/>
						{message && (
							<Alert
								variant={messageKind}
								role={messageKind === "error" ? "alert" : "status"}
							>
								<Alert.Body>{message}</Alert.Body>
							</Alert>
						)}
						<Button type="submit" isPending={pending}>
							Change password
						</Button>
					</Form>
					<p className={css.providerNote}>
						If you sign in only with Google or Facebook, change your password
						with that provider.
					</p>
					<AppLink to="/account" className={css.backLink}>
						Back to account
					</AppLink>
				</div>
			)}
		</section>
	);
}
