import { Alert, Button, Form, TextField } from "@code-x/lago";
import { useLocation } from "@tanstack/react-router";
import { ArrowRight, KeyRound } from "lucide-react";
import { AppLink } from "../../../../components/AppLink/AppLink";
import { AuthLayout } from "../../../../components/AuthLayout/AuthLayout";
import layoutCss from "../../../../components/AuthLayout/AuthLayout.module.css";
import { safeAuthDestination } from "../../../../modules/identity/auth-redirect";
import { useForgotPasswordForm } from "./ForgotPasswordPage.hooks";
import css from "./ForgotPasswordPage.module.css";

export function ForgotPasswordPage() {
	const search = useLocation({ select: (location) => location.searchStr });
	const next = safeAuthDestination(search);
	const form = useForgotPasswordForm(next);

	return (
		<AuthLayout>
			<div className={css.forgotPasswordPage}>
				<div className={layoutCss.cardHeading}>
					<span className={layoutCss.cardIcon}>
						<KeyRound aria-hidden="true" />
					</span>
					<p className={layoutCss.kicker}>YOUR ACCOUNT</p>
					<h2 id="auth-heading" className={layoutCss.heading}>
						Reset your password
					</h2>
					<p className={layoutCss.headingCopy}>
						Enter your email and we’ll send you a reset link.
					</p>
				</div>
				<Form className={layoutCss.form} onSubmit={form.submit}>
					<TextField
						className={layoutCss.field}
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
					{form.error && (
						<Alert variant="error" role="alert" className={layoutCss.feedback}>
							<Alert.Body>{form.error}</Alert.Body>
						</Alert>
					)}
					{form.sent && (
						<Alert
							variant="success"
							role="status"
							className={layoutCss.feedback}
						>
							<Alert.Body>
								If an account uses this email, a reset link is on its way. Check
								your inbox.
							</Alert.Body>
						</Alert>
					)}
					<Button
						className={layoutCss.submit}
						type="submit"
						size="lg"
						isPending={form.pending}
					>
						{form.pending
							? "Please wait…"
							: form.sent
								? "Send another link"
								: "Send reset link"}
						<ArrowRight aria-hidden="true" />
					</Button>
				</Form>
				<p className={layoutCss.switch}>
					<AppLink
						to="/login"
						search={{ next }}
						className={layoutCss.switchLink}
					>
						Back to sign in
					</AppLink>
				</p>
			</div>
		</AuthLayout>
	);
}
