import { Alert, Button, Form, Password, Skeleton } from "@code-x/lago";
import { AppLink } from "../../../../../components/AppLink/AppLink";
import { useSession } from "../../../../../modules/identity/auth-client";
import { useChangePasswordForm } from "./ChangePasswordPage.hooks";
import css from "./ChangePasswordPage.module.css";

export function ChangePasswordPage() {
	const { data: session, isPending, error: sessionError } = useSession();
	const form = useChangePasswordForm();

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
					<Form className={css.form} onSubmit={form.submit}>
						<Password
							label="Current password"
							name="current-password"
							autoComplete="current-password"
							value={form.currentPassword}
							onChange={form.setCurrentPassword}
							isRequired
							isDisabled={form.pending}
						/>
						<Password
							label="New password"
							name="new-password"
							autoComplete="new-password"
							value={form.newPassword}
							onChange={form.setNewPassword}
							minLength={8}
							isRequired
							isDisabled={form.pending}
						/>
						<Password
							label="Confirm new password"
							name="confirm-password"
							autoComplete="new-password"
							value={form.confirmPassword}
							onChange={form.setConfirmPassword}
							minLength={8}
							isRequired
							isDisabled={form.pending}
						/>
						{form.message && (
							<Alert
								variant={form.messageKind}
								role={form.messageKind === "error" ? "alert" : "status"}
							>
								<Alert.Body>{form.message}</Alert.Body>
							</Alert>
						)}
						<Button type="submit" isPending={form.pending}>
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
