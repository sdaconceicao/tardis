// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Viewport } from "./ExplorePage";
import { useDiscovery } from "./ExplorePage.hooks";

const { addToast, closeToast } = vi.hoisted(() => ({
	addToast: vi.fn(() => "map-toast"),
	closeToast: vi.fn(),
}));
vi.mock("@code-x/lago", () => ({
	ToastQueue: { add: addToast, close: closeToast },
}));

const viewport: Viewport = {
	west: -110,
	south: 30,
	east: -90,
	north: 45,
	zoom: 4,
};

function response(data: unknown) {
	return { ok: true, json: async () => data };
}

beforeEach(() => {
	vi.clearAllMocks();
});
afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

it("loads clusters for broad views and clears the loading state", async () => {
	const cluster = {
		cellX: 1,
		cellY: 1,
		count: 7,
		latitude: 39,
		longitude: -98,
		west: -99,
		east: -97,
		south: 38,
		north: 40,
	};
	const fetchMock = vi.fn().mockResolvedValue(
		response({
			clusters: [cluster],
			capped: false,
			approximate: true,
			catalogStatus: "ready",
		}),
	);
	vi.stubGlobal("fetch", fetchMock);
	const { result } = renderHook(() => useDiscovery(viewport, "museums"));
	await waitFor(() => expect(result.current.loading).toBe(false));
	expect(result.current.clusters).toEqual([cluster]);
	expect(result.current.clustersApproximate).toBe(true);
	expect(result.current.items).toEqual([]);
	expect(fetchMock.mock.calls[0][0]).toContain("/discovery/clusters?");
	expect(fetchMock.mock.calls[0][0]).toContain("category=museums");
});

it("loads individual POIs and appends the next page", async () => {
	const first = { id: "first", name: "Museum A" };
	const second = { id: "second", name: "Museum B" };
	const fetchMock = vi
		.fn()
		.mockResolvedValueOnce(
			response({
				items: [first],
				nextCursor: "first",
				catalogStatus: "ready",
			}),
		)
		.mockResolvedValueOnce(
			response({
				items: [second],
				nextCursor: null,
				catalogStatus: "ready",
			}),
		);
	vi.stubGlobal("fetch", fetchMock);
	const { result } = renderHook(() =>
		useDiscovery({ ...viewport, zoom: 9 }, ""),
	);
	await waitFor(() => expect(result.current.nextCursor).toBe("first"));
	await act(async () => result.current.loadMore());
	expect(result.current.items.map((item) => item.id)).toEqual([
		"first",
		"second",
	]);
	expect(result.current.nextCursor).toBeNull();
	expect(fetchMock.mock.calls[1][0]).toContain("cursor=first");
});

it("shows and closes the Lago toast for a slow request, then retries failures", async () => {
	let finishRequest = (_value: ReturnType<typeof response>) => {};
	const pending = new Promise<ReturnType<typeof response>>((resolve) => {
		finishRequest = resolve;
	});
	const fetchMock = vi
		.fn()
		.mockReturnValueOnce(pending)
		.mockRejectedValueOnce(new Error("offline"))
		.mockResolvedValueOnce(
			response({
				clusters: [],
				capped: false,
				approximate: false,
				catalogStatus: "ready",
			}),
		);
	vi.stubGlobal("fetch", fetchMock);
	const { result } = renderHook(() => useDiscovery(viewport, ""));
	await waitFor(() =>
		expect(addToast).toHaveBeenCalledWith({ title: "Updating map…" }),
	);
	await act(async () =>
		finishRequest(
			response({
				clusters: [],
				capped: false,
				approximate: false,
				catalogStatus: "ready",
			}),
		),
	);
	await waitFor(() => expect(closeToast).toHaveBeenCalledWith("map-toast"));
	act(() => result.current.retry());
	await waitFor(() => expect(result.current.error).toBe(true));
	act(() => result.current.retry());
	await waitFor(() => expect(result.current.error).toBe(false));
	expect(fetchMock.mock.calls[2][1].cache).toBe("no-store");
});

it("ignores an old response after the viewport changes", async () => {
	let finishOld = (_value: ReturnType<typeof response>) => {};
	const oldRequest = new Promise<ReturnType<typeof response>>((resolve) => {
		finishOld = resolve;
	});
	const fetchMock = vi
		.fn()
		.mockReturnValueOnce(oldRequest)
		.mockResolvedValueOnce(
			response({
				items: [{ id: "new", name: "New place" }],
				nextCursor: null,
				catalogStatus: "ready",
			}),
		);
	vi.stubGlobal("fetch", fetchMock);
	const { result, rerender } = renderHook(
		({ zoom }) => useDiscovery({ ...viewport, zoom }, ""),
		{ initialProps: { zoom: 4 } },
	);
	rerender({ zoom: 9 });
	await waitFor(() => expect(result.current.items[0]?.id).toBe("new"));
	expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
	await act(async () =>
		finishOld(
			response({
				clusters: [{ count: 999 }],
				capped: false,
				approximate: false,
				catalogStatus: "importing",
			}),
		),
	);
	expect(result.current.items[0]?.id).toBe("new");
	expect(result.current.catalogStatus).toBe("ready");
});
