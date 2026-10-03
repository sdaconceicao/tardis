import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import css from "./PlaceholderPage.module.css";

export function PlaceholderPage({
	eyebrow,
	title,
	description,
	icon: Icon,
	children,
	comingSoon = true,
}: {
	eyebrow: string;
	title: string;
	description: string;
	icon: LucideIcon;
	children?: ReactNode;
	comingSoon?: boolean;
}) {
	return (
		<section className={css.placeholderPage}>
			<p className={css.eyebrow}>{eyebrow}</p>
			<h1>{title}</h1>
			<div className={css.decoRule} aria-hidden="true" />
			<div className={css.placeholderSymbol}>
				<Icon aria-hidden="true" strokeWidth={1.25} />
			</div>
			<p className={css.placeholderDescription}>{description}</p>
			{children && <div className={css.placeholderActions}>{children}</div>}
			{comingSoon && <p className={css.previewNote}>Coming soon</p>}
		</section>
	);
}
