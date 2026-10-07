import type { ReactNode } from "react";
import { DiscoveryToolbar } from "../DiscoveryToolbar/DiscoveryToolbar";
import { ResultsPanel } from "../ResultsPanel/ResultsPanel";
import css from "./DiscoveryLayout.module.css";

export function DiscoveryLayout({
	title,
	eyebrow,
	showDateControl,
	metaLeft = "Public events & places",
	metaRight = "All regions",
	children,
	navigation,
	results,
}: {
	title: string;
	eyebrow?: string;
	showDateControl?: boolean;
	metaLeft?: string;
	metaRight?: string;
	children: ReactNode;
	navigation?: ReactNode;
	results?: ReactNode;
}) {
	return (
		<div className={css.discoveryLayout}>
			{results ?? <ResultsPanel />}
			<section className={css.discoveryMain} aria-labelledby="discovery-title">
				<DiscoveryToolbar
					title={title}
					eyebrow={eyebrow}
					showDateControl={showDateControl}
				/>
				<div className={css.discoveryMeta}>
					<span>{metaLeft}</span>
					<span>{metaRight}</span>
				</div>
				{navigation}
				{children}
			</section>
		</div>
	);
}
