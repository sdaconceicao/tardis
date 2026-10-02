import { Alert, Button, Form, Password, TextField } from "@code-x/lago";
import { useLocation } from "@tanstack/react-router";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { AppLink } from "../../../../components/AppLink/AppLink";
import { AuthLayout } from "../../../../components/AuthLayout/AuthLayout";
import css from "../../../../components/AuthLayout/AuthLayout.module.css";
import { AuthSocialButtons } from "../../../../components/AuthSocialButtons/AuthSocialButtons";
import { safeAuthDestination } from "../../../../modules/identity/auth-redirect";
import { useLoginForm } from "./LoginPage.hooks";

export function LoginPage() {
	const search = useLocation({ select: (location) => location.searchStr });
	const params = new URLSearchParams(search);
	const next = safeAuthDestination(search);
	const form = useLoginForm(next);

	return (
		<AuthLayout>
			<div className={css.cardHeading}>
				<span className={css.cardIcon}>
					<LockKeyhole aria-hidden="true" />
				</span>
				<p className={css.kicker}>YOUR ACCOUNT</p>
				<h2 id="auth-heading" className={css.heading}>
					Welcome back
				</h2>
				<p className={css.headingCopy}>Sign in to keep planning.</p>
			</div>
			{params.get("verified") === "1" && (
				<Alert variant="success" role="status" className={css.feedback}>
					<Alert.Body>Email verified. You can sign in now.</Alert.Body>
				</Alert>
			)}
			{Boolean(params.get("error")) && (
				<Alert variant="error" role="alert" className={css.feedback}>
					<Alert.Body>
						Social sign in did not complete. Please try again.
					</Alert.Body>
				</Alert>
			)}
			<Form className={css.form} onSubmit={form.submit}>
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
					autoComplete="current-password"
					value={form.password}
					onChange={form.setPassword}
					placeholder="Enter your password"
					isRequired
					size="lg"
				/>
				{form.message && (
					<Alert
						variant={form.messageKind}
						role={form.messageKind === "error" ? "alert" : "status"}
						className={css.feedback}
					>
						<Alert.Body>{form.message}</Alert.Body>
					</Alert>
				)}
				{form.needsVerification && (
					<Button
						variant="quiet"
						className={css.textButton}
						isDisabled={form.pending}
						onPress={form.resend}
					>
						Resend verification email
					</Button>
				)}
				<Button
					className={css.submit}
					type="submit"
					size="lg"
					isPending={form.pending}
				>
					{form.pending ? "Please wait…" : "Sign in"}
					<ArrowRight aria-hidden="true" />
				</Button>
			</Form>
			<AuthSocialButtons pending={form.pending} onSignIn={form.social} />
			<p className={css.switch}>
				Don't have an account?{" "}
				<AppLink to="/signup" search={{ next }} className={css.switchLink}>
					Sign up
				</AppLink>
			</p>
		</AuthLayout>
	);
}
