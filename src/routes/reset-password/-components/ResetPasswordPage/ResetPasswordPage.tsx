import { Alert, Button, Form, Password } from "@code-x/lago";
import { useLocation } from "@tanstack/react-router";
import { ArrowRight, KeyRound } from "lucide-react";
import { AppLink } from "../../../../components/AppLink/AppLink";
import { AuthLayout } from "../../../../components/AuthLayout/AuthLayout";
import layoutCss from "../../../../components/AuthLayout/AuthLayout.module.css";
import { safeAuthDestination } from "../../../../modules/identity/auth-redirect";
import { useResetPasswordForm } from "./ResetPasswordPage.hooks";
import css from "./ResetPasswordPage.module.css";

export function ResetPasswordPage() {
	const search = useLocation({ select: (location) => location.searchStr });
	const params = new URLSearchParams(search);
	const next = safeAuthDestination(search);
	const token = params.get("token");
	const form = useResetPasswordForm(token);
	const invalidLink =
		Boolean(params.get("error")) || !token || form.invalidToken;

	return (
		<AuthLayout>
			<div className={css.resetPasswordPage}>
				<div className={layoutCss.cardHeading}>
					<span className={layoutCss.cardIcon}>
						<KeyRound aria-hidden="true" />
					</span>
					<p className={layoutCss.kicker}>YOUR ACCOUNT</p>
					<h2 id="auth-heading" className={layoutCss.heading}>
						{form.complete ? "Password updated" : "Set a new password"}
					</h2>
					<p className={layoutCss.headingCopy}>
						{form.complete
							? "Your password has been changed. Sign in to continue."
							: "Choose a new password for your account."}
					</p>
				</div>
				{invalidLink ? (
					<Alert variant="error" role="alert" className={layoutCss.feedback}>
						<Alert.Body>
							This reset link is invalid or expired. Request a new one.
						</Alert.Body>
					</Alert>
				) : form.complete ? (
					<Alert variant="success" role="status" className={layoutCss.feedback}>
						<Alert.Body>Your password is ready to use.</Alert.Body>
					</Alert>
				) : (
					<Form className={layoutCss.form} onSubmit={form.submit}>
						<Password
							className={layoutCss.field}
							label="New password"
							name="new-password"
							autoComplete="new-password"
							value={form.password}
							onChange={form.setPassword}
							placeholder="Enter your new password"
							isRequired
							minLength={8}
							size="lg"
						/>
						<Password
							className={layoutCss.field}
							label="Confirm new password"
							name="confirm-password"
							autoComplete="new-password"
							value={form.confirmPassword}
							onChange={form.setConfirmPassword}
							placeholder="Confirm your new password"
							isRequired
							minLength={8}
							size="lg"
						/>
						{form.error && (
							<Alert
								variant="error"
								role="alert"
								className={layoutCss.feedback}
							>
								<Alert.Body>{form.error}</Alert.Body>
							</Alert>
						)}
						<Button
							className={layoutCss.submit}
							type="submit"
							size="lg"
							isPending={form.pending}
						>
							{form.pending ? "Please wait…" : "Reset password"}
							<ArrowRight aria-hidden="true" />
						</Button>
					</Form>
				)}
				<p className={layoutCss.switch}>
					<AppLink
						to={invalidLink ? "/forgot-password" : "/login"}
						search={{ next }}
						className={layoutCss.switchLink}
					>
						{invalidLink ? "Request a new link" : "Back to sign in"}
					</AppLink>
				</p>
			</div>
		</AuthLayout>
	);
}
