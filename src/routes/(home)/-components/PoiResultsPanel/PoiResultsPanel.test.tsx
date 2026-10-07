// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { PoiResultsPanel } from "./PoiResultsPanel";

afterEach(cleanup);

it("lets people select a POI and load the next page with Lago controls", async () => {
	const user = userEvent.setup();
	const onSelect = vi.fn();
	const onLoadMore = vi.fn();
	const onCategoryChange = vi.fn();
	render(
		<PoiResultsPanel
			items={[
				{
					id: "poi-1",
					name: "Museum of Flight",
					latitude: 47,
					longitude: -122,
					address: "Seattle",
					category: "museums",
					source: "Overture Maps Foundation",
					sourceRelease: "2026-09-23.1",
					hoursState: "unknown",
				},
			]}
			clusters={[]}
			clustersCapped={false}
			clustersApproximate={false}
			catalogStatus="ready"
			broad={false}
			loading={false}
			error={false}
			category=""
			onCategoryChange={onCategoryChange}
			selectedId={null}
			onSelect={onSelect}
			hasMore
			onLoadMore={onLoadMore}
			onRetry={vi.fn()}
		/>,
	);

	expect(screen.getByRole("combobox", { name: "Category" })).toBeTruthy();
	await user.click(screen.getByRole("button", { name: /Museum of Flight/ }));
	await user.click(screen.getByRole("button", { name: "Load more places" }));
	await user.click(screen.getByRole("combobox", { name: "Category" }));
	await user.click(screen.getByRole("option", { name: "Museums" }));
	expect(onSelect).toHaveBeenCalledWith("poi-1");
	expect(onLoadMore).toHaveBeenCalledOnce();
	expect(onCategoryChange).toHaveBeenCalledWith("museums");
});

it("shows a retry action when discovery fails", async () => {
	const user = userEvent.setup();
	const onRetry = vi.fn();
	render(
		<PoiResultsPanel
			items={[]}
			clusters={[]}
			clustersCapped={false}
			clustersApproximate={false}
			catalogStatus="ready"
			broad
			loading={false}
			error
			category=""
			onCategoryChange={vi.fn()}
			selectedId={null}
			onSelect={vi.fn()}
			hasMore={false}
			onLoadMore={vi.fn()}
			onRetry={onRetry}
		/>,
	);
	await user.click(screen.getByRole("button", { name: "Retry places" }));
	expect(onRetry).toHaveBeenCalledOnce();
});

it("explains empty results while the catalog is importing", () => {
	render(
		<PoiResultsPanel
			items={[]}
			clusters={[]}
			clustersCapped={false}
			clustersApproximate={false}
			catalogStatus="importing"
			broad={false}
			loading={false}
			error={false}
			category=""
			onCategoryChange={vi.fn()}
			selectedId={null}
			onSelect={vi.fn()}
			hasMore={false}
			onLoadMore={vi.fn()}
			onRetry={vi.fn()}
		/>,
	);
	expect(screen.getByText(/catalog is still importing/)).toBeTruthy();
});
