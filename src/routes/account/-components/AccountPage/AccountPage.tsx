import { Alert, Skeleton } from "@code-x/lago";
import { AppLink } from "../../../../components/AppLink/AppLink";
import { useSession } from "../../../../modules/identity/auth-client";
import { AccountAvatar } from "../AccountAvatar/AccountAvatar";
import { AccountProfile } from "../AccountProfile/AccountProfile";
import css from "./AccountPage.module.css";

export function AccountPage() {
	const { data: session, isPending, error } = useSession();

	return (
		<section className={css.page}>
			<header className={css.heading}>
				<p className={css.eyebrow}>Your profile</p>
				<h1>Account</h1>
				<p>Manage the details people see and how you sign in.</p>
			</header>
			{isPending ? (
				<div className={css.panel}>
					<Skeleton variant="line" height={48} label="Loading account" />
					<Skeleton variant="line" height={48} />
				</div>
			) : error ? (
				<Alert variant="error" role="alert">
					<Alert.Body>
						Could not load your account. Refresh and try again.
					</Alert.Body>
				</Alert>
			) : session?.user ? (
				<div className={css.panel}>
					<AccountAvatar user={session.user} />
					<AccountProfile user={session.user} />
				</div>
			) : (
				<div className={css.prompt}>
					<p>Sign in to manage your account.</p>
					<AppLink to="/login" search={{ next: "/account" }}>
						Sign in
					</AppLink>
				</div>
			)}
		</section>
	);
}
