import { Alert, Button, Form, TextField } from "@code-x/lago";
import { type FormEvent, useState } from "react";
import { AppLink } from "../../../../components/AppLink/AppLink";
import { authClient } from "../../../../modules/identity/auth-client";
import css from "./AccountProfile.module.css";

type AccountProfileProps = {
	user: { name: string; email: string };
};

export function AccountProfile({ user }: AccountProfileProps) {
	const [name, setName] = useState(user.name);
	const [savedName, setSavedName] = useState(user.name);
	const [pending, setPending] = useState(false);
	const [message, setMessage] = useState("");
	const [messageKind, setMessageKind] = useState<"error" | "success">(
		"success",
	);

	async function saveName(event: FormEvent<HTMLFormElement>) {
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
				error instanceof Error ? error.message : "Could not update your name.",
			);
		} finally {
			setPending(false);
		}
	}

	return (
		<div className={css.profile}>
			<section className={css.section} aria-labelledby="profile-heading">
				<h2 id="profile-heading">Profile details</h2>
				{message && (
					<Alert
						variant={messageKind}
						role={messageKind === "error" ? "alert" : "status"}
					>
						<Alert.Body>{message}</Alert.Body>
					</Alert>
				)}
				<Form
					id="account-profile-form"
					className={css.form}
					onSubmit={saveName}
				>
					<TextField
						className={css.nameField}
						label="Name"
						name="name"
						value={name}
						onChange={setName}
						isRequired
						isDisabled={pending}
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
				isPending={pending}
				isDisabled={name.trim() === savedName.trim()}
			>
				Save
			</Button>
		</div>
	);
}
