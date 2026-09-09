import lagoCss from "@code-x/lago/styles?url";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
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
				href: lagoCss,
			},
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}

				<Scripts />
			</body>
		</html>
	);
}
