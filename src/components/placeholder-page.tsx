import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

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
		<section className="placeholder-page">
			<p className="eyebrow">{eyebrow}</p>
			<h1>{title}</h1>
			<div className="deco-rule" aria-hidden="true" />
			<div className="placeholder-symbol">
				<Icon aria-hidden="true" strokeWidth={1.25} />
			</div>
			<p className="placeholder-description">{description}</p>
			{children && <div className="placeholder-actions">{children}</div>}
			{comingSoon && <p className="preview-note">Coming soon</p>}
		</section>
	);
}
