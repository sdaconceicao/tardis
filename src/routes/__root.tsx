import lagoCss from "@code-x/lago/styles?url";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { AppLink, AppShell } from "../components/app-shell";
import { PlaceholderPage } from "../components/placeholder-page";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Tardis",
			},
			{
				name: "description",
				content:
					"Plan a day around recurring events, interesting places, opening hours, and travel time.",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Josefin+Sans:wght@400;500;600&family=Source+Sans+3:wght@400;500;600&display=swap",
			},
			{
				rel: "stylesheet",
				href: lagoCss,
			},
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	shellComponent: RootDocument,
	notFoundComponent: () => (
		<PlaceholderPage
			eyebrow="Off the beaten path"
			title="Page not found"
			description="This destination isn’t on the map. Head back to explore."
			icon={Compass}
			comingSoon={false}
		>
			<AppLink to="/" className="primary-link">
				Back to explore
			</AppLink>
		</PlaceholderPage>
	),
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<script>{`try{const theme=localStorage.getItem('tardis-theme');document.documentElement.classList.toggle('dark-mode',theme==='dark'||(!['light','dark'].includes(theme)&&matchMedia('(prefers-color-scheme: dark)').matches));}catch{}`}</script>
				<HeadContent />
			</head>
			<body>
				<AppShell>{children}</AppShell>

				<Scripts />
			</body>
		</html>
	);
}
