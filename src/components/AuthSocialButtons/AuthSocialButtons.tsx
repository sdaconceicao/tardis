import { Button } from "@code-x/lago";
import type { SocialProvider } from "../../modules/identity/auth-client-actions";
import css from "./AuthSocialButtons.module.css";

export function AuthSocialButtons({
	pending,
	onSignIn,
}: {
	pending: boolean;
	onSignIn: (provider: SocialProvider) => void;
}) {
	return (
		<div className={css.authSocialButtons}>
			<div className={css.divider}>
				<span>OR CONTINUE WITH</span>
			</div>
			<div className={css.buttons}>
				<Button
					variant="secondary"
					size="lg"
					isDisabled={pending}
					onPress={() => onSignIn("google")}
				>
					<span className={css.googleMark} aria-hidden="true">
						G
					</span>{" "}
					Google
				</Button>
				<Button
					variant="secondary"
					size="lg"
					isDisabled={pending}
					onPress={() => onSignIn("facebook")}
				>
					<span className={css.facebookMark} aria-hidden="true">
						f
					</span>{" "}
					Facebook
				</Button>
			</div>
		</div>
	);
}
