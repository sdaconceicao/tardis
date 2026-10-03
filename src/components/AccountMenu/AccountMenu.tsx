import {
	Alert,
	Avatar,
	Button,
	Dialog,
	DialogTrigger,
	Sheet,
} from "@code-x/lago";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { signOut } from "../../modules/identity/auth-client";
import { AppLink } from "../AppLink/AppLink";
import css from "./AccountMenu.module.css";

type AccountMenuProps = {
	user: { name: string; email: string; image?: string | null };
};

export function AccountMenu({ user }: AccountMenuProps) {
	const navigate = useNavigate();
	const [isOpen, setIsOpen] = useState(false);
	const [isSigningOut, setIsSigningOut] = useState(false);
	const [error, setError] = useState("");
	const profileRef = useRef<HTMLDivElement>(null);
	const name = user.name.trim() || user.email;

	useEffect(() => {
		if (!isOpen) return;

		function closeOnOutsidePointer(event: PointerEvent) {
			const sheet = profileRef.current?.closest(".sheet");
			if (
				sheet &&
				event.target instanceof Node &&
				!sheet.contains(event.target)
			) {
				setIsOpen(false);
			}
		}

		document.addEventListener("pointerdown", closeOnOutsidePointer);
		return () =>
			document.removeEventListener("pointerdown", closeOnOutsidePointer);
	}, [isOpen]);

	async function handleSignOut() {
		setIsSigningOut(true);
		setError("");
		try {
			const result = await signOut();
			if (result.error) {
				throw new Error(result.error.message || "Could not log out.");
			}
			setIsOpen(false);
			await navigate({ to: "/login" });
		} catch {
			setError("Could not log out. Please try again.");
		} finally {
			setIsSigningOut(false);
		}
	}

	return (
		<DialogTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
			<Button
				variant="quiet"
				className={css.trigger}
				aria-label={`Open account menu for ${name}`}
			>
				<Avatar src={user.image ?? undefined} name={name} size="md" />
			</Button>
			<Sheet>
				<Dialog.Header title="Your account" />
				<Dialog.Body className={css.body}>
					<div ref={profileRef} className={css.profile}>
						<Avatar src={user.image ?? undefined} name={name} size="lg" />
						<div className={css.profileText}>
							<strong>{name}</strong>
							<span>{user.email}</span>
						</div>
					</div>
					<nav className={css.actions} aria-label="Account menu">
						<AppLink
							to="/account"
							className={css.action}
							onPress={() => setIsOpen(false)}
						>
							<UserRound aria-hidden="true" />
							Account
						</AppLink>
						<Button
							variant="quiet"
							className={css.action}
							isPending={isSigningOut}
							onPress={handleSignOut}
						>
							<LogOut aria-hidden="true" />
							Logout
						</Button>
					</nav>
					{error && (
						<Alert variant="error" role="alert">
							<Alert.Body>{error}</Alert.Body>
						</Alert>
					)}
				</Dialog.Body>
			</Sheet>
		</DialogTrigger>
	);
}
