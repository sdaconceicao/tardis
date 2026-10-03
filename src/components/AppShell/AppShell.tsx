import { Link, ThemeProvider } from "@code-x/lago";
import type { ReactNode } from "react";
import { AppHeader } from "../AppHeader/AppHeader";
import css from "./AppShell.module.css";

export { AppLink } from "../AppLink/AppLink";

export function AppShell({ children }: { children: ReactNode }) {
	return (
		<ThemeProvider defaultTheme="system" storageKey="tardis-theme">
			<Link href="#main-content" className={css.skipLink}>
				Skip to content
			</Link>
			<div className={css.appShell}>
				<AppHeader />
				<main id="main-content" className={css.appContent}>
					{children}
				</main>
				<footer className={css.appFooter}>
					<span>
						Tardis{" "}
						<span className={css.footerDivider} aria-hidden="true">
							/
						</span>{" "}
						Discover a day worth going out for.
					</span>
					<span>Preview · navigation only</span>
				</footer>
			</div>
		</ThemeProvider>
	);
}
