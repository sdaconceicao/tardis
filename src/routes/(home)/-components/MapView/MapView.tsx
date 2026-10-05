import { useEffect, useRef, useState } from "react";
import css from "./MapView.module.css";

const fallbackStyle = "https://tiles.openfreemap.org/styles/liberty";

export function MapView() {
	const container = useRef<HTMLDivElement>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		let disposed = false;
		let removeMap: (() => void) | undefined;
		let resizeObserver: ResizeObserver | undefined;
		const element = container.current;
		if (!element) return;

		Promise.all([
			import("maplibre-gl"),
			import("maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"),
		])
			.then(([maplibre, worker]) => {
				if (disposed) return;
				maplibre.setWorkerUrl(worker.default);
				const map = new maplibre.Map({
					container: element,
					style: import.meta.env.VITE_MAP_STYLE_URL || fallbackStyle,
					center: [-98, 39],
					zoom: 3,
				});
				removeMap = () => map.remove();
				map.addControl(new maplibre.NavigationControl(), "top-right");
				map.on("error", () => setFailed(true));
				map.on("load", () => setFailed(false));
				resizeObserver = new ResizeObserver(() => map.resize());
				resizeObserver.observe(element);
			})
			.catch(() => {
				if (!disposed) setFailed(true);
			});

		return () => {
			disposed = true;
			resizeObserver?.disconnect();
			removeMap?.();
		};
	}, []);

	return (
		<section className={css.mapView} aria-label="Explore map">
			<div className={css.mapCanvas} ref={container} />
			{failed && (
				<output className={css.mapError}>
					Map tiles are unavailable. Browse places in the results list.
				</output>
			)}
		</section>
	);
}
