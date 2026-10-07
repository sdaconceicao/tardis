import { Button, Select, SelectItem } from "@code-x/lago";
import clsx from "clsx";
import type {
	CatalogStatus,
	Poi,
	PoiCluster,
} from "../ExplorePage/ExplorePage";
import css from "./PoiResultsPanel.module.css";

const categories = [
	{ id: "all", name: "All categories" },
	{ id: "museums", name: "Museums" },
	{ id: "entertainment", name: "Entertainment venues" },
	{ id: "landmarks", name: "Landmarks" },
	{ id: "parks", name: "Parks" },
	{ id: "restaurants", name: "Restaurants" },
];

type Props = {
	items: Poi[];
	clusters: PoiCluster[];
	clustersCapped: boolean;
	clustersApproximate: boolean;
	catalogStatus: CatalogStatus;
	broad: boolean;
	loading: boolean;
	error: boolean;
	category: string;
	onCategoryChange(category: string): void;
	selectedId: string | null;
	onSelect(id: string): void;
	hasMore: boolean;
	onLoadMore(): void;
	onRetry(): void;
};

export function PoiResultsPanel(props: Props) {
	const count = props.broad
		? props.clusters.reduce((sum, cluster) => sum + cluster.count, 0)
		: props.items.length;
	const noun = count === 1 ? "place" : "places";
	return (
		<aside className={css.panel} aria-label="Places to explore">
			<p className={css.eyebrow}>Explore places</p>
			<h2>Points of interest</h2>
			<Select
				label="Category"
				items={categories}
				selectedKey={props.category || "all"}
				onSelectionChange={(key) =>
					props.onCategoryChange(
						key === "all" || key === null ? "" : String(key),
					)
				}
				className={css.filter}
			>
				{(item) => <SelectItem id={item.id}>{item.name}</SelectItem>}
			</Select>
			<div role="status" aria-live="polite" className={css.status}>
				{props.loading
					? "Loading places…"
					: props.error
						? "Places could not be loaded."
						: props.broad
							? `${props.clustersCapped ? "At least " : props.clustersApproximate ? "About " : ""}${count.toLocaleString()} ${noun} ${props.clustersApproximate ? "near" : "in"} this map area. Zoom in to browse individual places.`
							: `${count.toLocaleString()} ${noun} shown${props.hasMore ? "+" : ""}.`}
			</div>
			{props.error && (
				<Button variant="secondary" onPress={props.onRetry}>
					Retry places
				</Button>
			)}
			{!props.loading &&
				!props.error &&
				props.catalogStatus === "importing" && (
					<p className={css.empty}>
						The POI catalog is still importing. Results may change.
					</p>
				)}
			{!props.loading &&
				!props.error &&
				count === 0 &&
				props.catalogStatus !== "importing" && (
					<p className={css.empty}>
						{props.catalogStatus === "empty"
							? "No POIs have been imported yet."
							: "No imported places match this area and category."}
					</p>
				)}
			{!props.broad && (
				<ul className={css.list}>
					{props.items.map((item) => (
						<li key={item.id}>
							<Button
								variant="quiet"
								className={clsx(
									css.card,
									item.id === props.selectedId && css.selected,
								)}
								onPress={() => props.onSelect(item.id)}
								aria-pressed={item.id === props.selectedId}
							>
								<strong>{item.name}</strong>
								<span>
									{item.category ?? "Place"}
									{item.address ? ` · ${item.address}` : ""}
								</span>
								<small>{item.source} · Hours unknown</small>
							</Button>
						</li>
					))}
				</ul>
			)}
			{props.hasMore && !props.broad && (
				<Button
					variant="secondary"
					className={css.more}
					isDisabled={props.loading}
					onPress={props.onLoadMore}
				>
					Load more places
				</Button>
			)}
		</aside>
	);
}
