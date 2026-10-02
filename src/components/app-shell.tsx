import { IconButton, Link, ThemeProvider, useTheme } from "@code-x/lago";
import { createLink, useLocation } from "@tanstack/react-router";
import {
	CalendarDays,
	Map as MapIcon,
	MapPin,
	Moon,
	Plus,
	Sun,
	UserRound,
} from "lucide-react";
import type { ReactNode } from "react";

// Keep Lago's accessible link behavior while adding TanStack's typed routing.
export const AppLink = createLink(Link);

function AppearanceButton() {
	const { setTheme } = useTheme();
	return (
		<IconButton
			className="appearance-button"
			variant="quiet"
			aria-label="Toggle light and dark mode"
			onPress={() =>
				setTheme(
					document.documentElement.classList.contains("dark-mode")
						? "light"
						: "dark",
				)
			}
		>
			<Sun className="theme-sun" aria-hidden="true" />
			<Moon className="theme-moon" aria-hidden="true" />
		</IconButton>
	);
}

export function AppShell({ children }: { children: ReactNode }) {
	const pathname = useLocation({ select: (location) => location.pathname });
	const isDiscovery = pathname === "/" || pathname === "/calendar";
	return (
		<ThemeProvider defaultTheme="system" storageKey="tardis-theme">
			<Link href="#main-content" className="skip-link">
				Skip to content
			</Link>
			<div className="app-shell">
				<header className="app-header">
					<div className="masthead">
						<AppLink to="/" className="brand" aria-label="Tardis home">
							<span className="brand-stripes" aria-hidden="true" />
							<span>Tardis</span>
						</AppLink>
						<span className="header-location">
							<MapPin aria-hidden="true" /> United States
						</span>
						<nav className="view-navigation" aria-label="Discovery view">
							<AppLink to="/" activeOptions={{ exact: true }}>
								<MapIcon aria-hidden="true" />
								Map
							</AppLink>
							<AppLink
								to="/calendar"
								search={{ view: "week" }}
								activeOptions={{ includeSearch: false }}
							>
								<CalendarDays aria-hidden="true" />
								Calendar
							</AppLink>
						</nav>
						<div className="header-actions">
							<AppLink to="/signup" className="primary-link">
								<Plus aria-hidden="true" />
								Add event
							</AppLink>
							<AppearanceButton />
							<AppLink
								to="/login"
								className="account-link"
								aria-label="Sign in"
							>
								<UserRound aria-hidden="true" />
							</AppLink>
						</div>
					</div>
					<nav className="section-navigation" aria-label="Main navigation">
						<AppLink
							to="/"
							activeOptions={{ exact: true }}
							className={isDiscovery ? "section-current" : undefined}
						>
							Explore
						</AppLink>
						<AppLink to="/saved">Saved</AppLink>
						<AppLink to="/my-events">My events</AppLink>
					</nav>
				</header>
				<main id="main-content" className="app-content">
					{children}
				</main>
				<footer className="app-footer">
					<span>
						Tardis <span aria-hidden="true">/</span> Discover a day worth going
						out for.
					</span>
					<span>Preview · navigation only</span>
				</footer>
			</div>
		</ThemeProvider>
	);
}
