import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
	return (
		<main className="app-shell">
			<p className="eyebrow">Foundation ready</p>
			<h1>Tardis</h1>
			<p className="lede">
				Plan a day around recurring events, interesting places, their opening
				hours, and the time it takes to get there.
			</p>

			<section aria-labelledby="foundation-heading" className="status-panel">
				<h2 id="foundation-heading">Modular monolith</h2>
				<p>
					TanStack Start provides the UI and BFF, Neon/PostGIS owns application
					data, and routing begins behind an extractable in-process service.
				</p>
			</section>
		</main>
	);
}
