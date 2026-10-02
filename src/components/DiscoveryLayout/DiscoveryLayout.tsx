import type { ReactNode } from "react";
import { DiscoveryToolbar } from "../DiscoveryToolbar/DiscoveryToolbar";
import { ResultsPanel } from "../ResultsPanel/ResultsPanel";
import css from "./DiscoveryLayout.module.css";

export function DiscoveryLayout({
	title,
	children,
	navigation,
}: {
	title: string;
	children: ReactNode;
	navigation?: ReactNode;
}) {
	return (
		<div className={css.discoveryLayout}>
			<ResultsPanel />
			<section className={css.discoveryMain} aria-labelledby="discovery-title">
				<DiscoveryToolbar title={title} />
				<div className={css.discoveryMeta}>
					<span>Public events & places</span>
					<span>All regions</span>
				</div>
				{navigation}
				{children}
			</section>
		</div>
	);
}
