import { Alert, Button, Form, Password, TextField } from "@code-x/lago";
import { useLocation } from "@tanstack/react-router";
import { ArrowRight, LockKeyhole, MailCheck } from "lucide-react";
import { AppLink } from "../../../../components/AppLink/AppLink";
import { AuthLayout } from "../../../../components/AuthLayout/AuthLayout";
import css from "../../../../components/AuthLayout/AuthLayout.module.css";
import { AuthSocialButtons } from "../../../../components/AuthSocialButtons/AuthSocialButtons";
import { safeAuthDestination } from "../../../../modules/identity/auth-redirect";
import { useSignupForm } from "./SignupPage.hooks";

export function SignupPage() {
	const search = useLocation({ select: (location) => location.searchStr });
	const next = safeAuthDestination(search);
	const form = useSignupForm(next);

	return (
		<AuthLayout>
			{form.sent ? (
				<div className={css.sent}>
					<MailCheck className={css.sentIcon} aria-hidden="true" />
					<h2 id="auth-heading" className={css.heading}>
						Check your inbox
					</h2>
					<p className={css.sentCopy}>
						We sent a verification link to <strong>{form.email.trim()}</strong>.
						Open it to activate your account.
					</p>
					<Button
						variant="quiet"
						className={css.textButton}
						isDisabled={form.pending}
						onPress={form.resend}
					>
						Resend verification email
					</Button>
					<AppLink to="/login" search={{ next }} className={css.submitLink}>
						Back to sign in <ArrowRight aria-hidden="true" />
					</AppLink>
					{form.message && (
						<Alert
							variant={form.messageKind}
							role={form.messageKind === "error" ? "alert" : "status"}
							className={css.feedback}
						>
							<Alert.Body>{form.message}</Alert.Body>
						</Alert>
					)}
				</div>
			) : (
				<>
					<div className={css.cardHeading}>
						<span className={css.cardIcon}>
							<LockKeyhole aria-hidden="true" />
						</span>
						<p className={css.kicker}>YOUR ACCOUNT</p>
						<h2 id="auth-heading" className={css.heading}>
							Create account
						</h2>
						<p className={css.headingCopy}>Join Tardis and start exploring.</p>
					</div>
					<Form className={css.form} onSubmit={form.submit}>
						<TextField
							className={css.field}
							label="Name"
							name="name"
							autoComplete="name"
							value={form.name}
							onChange={form.setName}
							placeholder="Your name"
							isRequired
							maxLength={100}
							size="lg"
						/>
						<TextField
							className={css.field}
							label="Email"
							name="email"
							type="email"
							autoComplete="email"
							value={form.email}
							onChange={form.setEmail}
							placeholder="Enter your email"
							isRequired
							size="lg"
						/>
						<Password
							className={css.field}
							label="Password"
							name="password"
							autoComplete="new-password"
							value={form.password}
							onChange={form.setPassword}
							placeholder="Enter your password"
							isRequired
							minLength={8}
							size="lg"
						/>
						<Password
							className={css.field}
							label="Confirm password"
							name="confirm-password"
							autoComplete="new-password"
							value={form.confirmPassword}
							onChange={form.setConfirmPassword}
							placeholder="Confirm your password"
							isRequired
							minLength={8}
							size="lg"
						/>
						{form.message && (
							<Alert variant="error" role="alert" className={css.feedback}>
								<Alert.Body>{form.message}</Alert.Body>
							</Alert>
						)}
						<Button
							className={css.submit}
							type="submit"
							size="lg"
							isPending={form.pending}
						>
							{form.pending ? "Please wait…" : "Create account"}
							<ArrowRight aria-hidden="true" />
						</Button>
					</Form>
					<AuthSocialButtons pending={form.pending} onSignIn={form.social} />
					<p className={css.switch}>
						Already have an account?{" "}
						<AppLink to="/login" search={{ next }} className={css.switchLink}>
							Sign in
						</AppLink>
					</p>
				</>
			)}
		</AuthLayout>
	);
}
