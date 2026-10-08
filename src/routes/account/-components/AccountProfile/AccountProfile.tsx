import { Alert, Button, Form, TextField } from "@code-x/lago";
import { AppLink } from "../../../../components/AppLink/AppLink";
import { useAccountProfile } from "./AccountProfile.hooks";
import css from "./AccountProfile.module.css";

type AccountProfileProps = {
	user: { name: string; email: string };
};

export function AccountProfile({ user }: AccountProfileProps) {
	const form = useAccountProfile(user.name);

	return (
		<div className={css.profile}>
			<section className={css.section} aria-labelledby="profile-heading">
				<h2 id="profile-heading">Profile details</h2>
				{form.message && (
					<Alert
						variant={form.messageKind}
						role={form.messageKind === "error" ? "alert" : "status"}
					>
						<Alert.Body>{form.message}</Alert.Body>
					</Alert>
				)}
				<Form
					id="account-profile-form"
					className={css.form}
					onSubmit={form.saveName}
				>
					<TextField
						className={css.nameField}
						label="Name"
						name="name"
						value={form.name}
						onChange={form.setName}
						isRequired
						isDisabled={form.pending}
					/>
					<div className={css.emailRow}>
						<span>Email</span>
						<strong>{user.email}</strong>
					</div>
				</Form>
			</section>
			<section className={css.section} aria-labelledby="password-heading">
				<h2 id="password-heading">Password</h2>
				<p>Update the password you use to sign in.</p>
				<AppLink to="/account/password" className={css.passwordLink}>
					Change password
				</AppLink>
			</section>
			<Button
				className={css.save}
				type="submit"
				form="account-profile-form"
				isPending={form.pending}
				isDisabled={!form.canSave}
			>
				Save
			</Button>
		</div>
	);
}
