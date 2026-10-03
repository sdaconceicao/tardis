import { Avatar } from "@code-x/lago";
import { useLocation } from "@tanstack/react-router";
import {
	CalendarDays,
	Map as MapIcon,
	MapPin,
	Plus,
	UserRound,
} from "lucide-react";
import { useSession } from "../../modules/identity/auth-client";
import { AppearanceButton } from "../AppearanceButton/AppearanceButton";
import { AppLink } from "../AppLink/AppLink";
import actionCss from "../AppLink/AppLink.module.css";
import css from "./AppHeader.module.css";

export function AppHeader() {
	const location = useLocation();
	const { data: session } = useSession();
	const accountName = session?.user
		? session.user.name.trim() || session.user.email
		: "";
	const pathname = location.pathname;
	const isDiscovery = pathname === "/" || pathname === "/calendar";
	return (
		<header className={css.appHeader}>
			<div className={css.masthead}>
				<AppLink to="/" className={css.brand} aria-label="Tardis home">
					<span className={css.brandStripes} aria-hidden="true" />
					<span>Tardis</span>
				</AppLink>
				<span className={css.headerLocation}>
					<MapPin aria-hidden="true" /> United States
				</span>
				<nav className={css.viewNavigation} aria-label="Discovery view">
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
				<div className={css.headerActions}>
					<AppLink
						to="/signup"
						search={{ next: "/my-events" }}
						className={actionCss.primaryLink}
					>
						<Plus className={css.addEventIcon} aria-hidden="true" />
						Add event
					</AppLink>
					<AppearanceButton />
					{session?.user ? (
						<AppLink
							to="/my-events"
							className={css.accountLink}
							aria-label={`Account: ${accountName}`}
						>
							<Avatar
								src={session.user.image ?? undefined}
								name={accountName}
								size="md"
							/>
						</AppLink>
					) : (
						<AppLink
							to="/login"
							search={{ next: pathname + location.searchStr }}
							className={css.accountLink}
							aria-label="Sign in"
						>
							<UserRound aria-hidden="true" />
						</AppLink>
					)}
				</div>
			</div>
			<nav className={css.sectionNavigation} aria-label="Main navigation">
				<AppLink
					to="/"
					activeOptions={{ exact: true }}
					className={isDiscovery ? css.sectionCurrent : undefined}
				>
					Explore
				</AppLink>
				<AppLink to="/saved">Saved</AppLink>
				<AppLink to="/my-events">My events</AppLink>
			</nav>
		</header>
	);
}
