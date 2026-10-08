import { ToastQueue } from "@code-x/lago";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CatalogStatus, Poi, PoiCluster, Viewport } from "./ExplorePage";

export function useDiscovery(viewport: Viewport, category: string) {
	const [items, setItems] = useState<Poi[]>([]);
	const [clusters, setClusters] = useState<PoiCluster[]>([]);
	const [clustersCapped, setClustersCapped] = useState(false);
	const [clustersApproximate, setClustersApproximate] = useState(false);
	const [catalogStatus, setCatalogStatus] = useState<CatalogStatus>("empty");
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const [retryCount, setRetryCount] = useState(0);
	const loadMoreController = useRef<AbortController | null>(null);
	const broad = viewport.zoom < 8;

	useEffect(() => {
		loadMoreController.current?.abort();
		const controller = new AbortController();
		let toastKey: string | null = null;
		const toastDelay = window.setTimeout(() => {
			if (!controller.signal.aborted) {
				toastKey = ToastQueue.add({ title: "Updating map…" });
			}
		}, 150);
		function dismissToast() {
			window.clearTimeout(toastDelay);
			if (toastKey) ToastQueue.close(toastKey);
			toastKey = null;
		}
		const params = new URLSearchParams({
			west: String(viewport.west),
			south: String(viewport.south),
			east: String(viewport.east),
			north: String(viewport.north),
		});
		if (category) params.set("category", category);
		const path = broad ? "/api/v1/discovery/clusters" : "/api/v1/discovery";
		if (broad) params.set("zoom", String(Math.floor(viewport.zoom)));
		setLoading(true);
		setError(false);
		if (broad) setItems([]);
		else setClusters([]);
		fetch(`${path}?${params}`, {
			signal: controller.signal,
			cache: retryCount === 0 ? "default" : "no-store",
		})
			.then(async (response) => {
				if (!response.ok)
					throw new Error(`Discovery returned ${response.status}`);
				return response.json();
			})
			.then((data) => {
				if (controller.signal.aborted) return;
				setCatalogStatus(data.catalogStatus);
				if (broad) {
					setClusters(data.clusters);
					setClustersCapped(Boolean(data.capped));
					setClustersApproximate(Boolean(data.approximate));
					setItems([]);
					setNextCursor(null);
				} else {
					setItems(data.items);
					setClusters([]);
					setClustersCapped(false);
					setClustersApproximate(false);
					setNextCursor(data.nextCursor);
				}
				setLoading(false);
			})
			.catch(() => {
				if (!controller.signal.aborted) {
					setError(true);
					setLoading(false);
				}
			})
			.finally(dismissToast);
		return () => {
			controller.abort();
			dismissToast();
			loadMoreController.current?.abort();
			loadMoreController.current = null;
		};
	}, [
		viewport.west,
		viewport.south,
		viewport.east,
		viewport.north,
		viewport.zoom,
		category,
		broad,
		retryCount,
	]);

	const loadMore = useCallback(async () => {
		if (!nextCursor || loading || broad) return;
		const controller = new AbortController();
		loadMoreController.current = controller;
		setLoading(true);
		try {
			const params = new URLSearchParams({
				west: String(viewport.west),
				south: String(viewport.south),
				east: String(viewport.east),
				north: String(viewport.north),
				cursor: nextCursor,
			});
			if (category) params.set("category", category);
			const response = await fetch(`/api/v1/discovery?${params}`, {
				signal: controller.signal,
			});
			if (!response.ok)
				throw new Error(`Discovery returned ${response.status}`);
			const data = await response.json();
			setItems((previous) => [...previous, ...data.items]);
			setNextCursor(data.nextCursor);
			setCatalogStatus(data.catalogStatus);
		} catch {
			if (!controller.signal.aborted) setError(true);
		} finally {
			if (loadMoreController.current === controller) {
				loadMoreController.current = null;
				setLoading(false);
			}
		}
	}, [
		nextCursor,
		loading,
		broad,
		viewport.west,
		viewport.south,
		viewport.east,
		viewport.north,
		category,
	]);
	const retry = useCallback(() => setRetryCount((count) => count + 1), []);

	return {
		items,
		clusters,
		clustersCapped,
		clustersApproximate,
		catalogStatus,
		nextCursor,
		loading,
		error,
		broad,
		loadMore,
		retry,
	};
}
