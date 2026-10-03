import type { ReactNode } from "react";
import css from "./AuthLayout.module.css";

export function AuthLayout({ children }: { children: ReactNode }) {
	return (
		<div className={css.authLayout}>
			<div className={css.layout}>
				<section className={css.intro}>
					<p className={css.kicker}>YOUR NEXT DAY OUT STARTS HERE</p>
					<h1 className={css.introTitle}>Find your place in the day.</h1>
					<p className={css.introCopy}>
						Save the places you love and share events worth making time for.
					</p>
					<div className={css.introRule} aria-hidden="true" />
					<span className={css.introTagline}>EXPLORE · PLAN · GO</span>
				</section>
				<section className={css.card} aria-labelledby="auth-heading">
					{children}
				</section>
			</div>
		</div>
	);
}
