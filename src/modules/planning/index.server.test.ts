import { beforeEach, describe, expect, it, vi } from "vitest";
import { findAvailability } from "./index.server";

const mocks = vi.hoisted(() => ({
	nearbyLocations: vi.fn(),
	findAvailableEvents: vi.fn(),
	findAvailablePlaces: vi.fn(),
}));
vi.mock("../events/index.server", () => ({
	findAvailableEvents: mocks.findAvailableEvents,
}));
vi.mock("../places/index.server", () => ({
	nearbyLocations: mocks.nearbyLocations,
	findAvailablePlaces: mocks.findAvailablePlaces,
}));

const query = {
	at: new Date("2026-09-18T12:00:00Z"),
	latitude: 40,
	longitude: -73,
	radiusMeters: 25000,
	limit: 2,
	offset: 0,
};
const location = {
	id: "loc",
	label: "Park",
	address: null,
	latitude: 40,
	longitude: -73,
};

beforeEach(() => {
	vi.clearAllMocks();
	mocks.nearbyLocations.mockResolvedValue([location]);
	mocks.findAvailableEvents.mockResolvedValue([]);
	mocks.findAvailablePlaces.mockResolvedValue([]);
});

describe("findAvailability", () => {
	it("uses a read-only snapshot and returns an empty page when no locations match", async () => {
		mocks.nearbyLocations.mockResolvedValue([]);
		const tx = { token: "transaction" };
		const transaction = vi.fn((run) => run(tx));
		const result = await findAvailability(
			{ transaction } as never,
			null,
			query,
		);
		expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
			isolationLevel: "repeatable read",
			accessMode: "read only",
		});
		expect(mocks.findAvailableEvents).toHaveBeenCalledWith(tx, null, query, []);
		expect(mocks.findAvailablePlaces).toHaveBeenCalledWith(tx, null, query, []);
		expect(result).toEqual({
			at: query.at.toISOString(),
			items: [],
			total: 0,
			hasMore: false,
		});
	});

	it("sorts results, attaches locations, and paginates after combining domains", async () => {
		mocks.findAvailableEvents.mockResolvedValue([
			{ kind: "event", id: "e2", title: "Zoo", locationId: "loc" },
			{ kind: "event", id: "e1", title: "Art", locationId: "loc" },
		]);
		mocks.findAvailablePlaces.mockResolvedValue([
			{ kind: "place", id: "p1", title: "Cafe", locationId: "loc" },
		]);
		const transaction = vi.fn((run) => run({}));
		const result = await findAvailability(
			{ transaction } as never,
			{ subject: "owner" },
			{ ...query, offset: 1 },
		);
		expect(result.total).toBe(3);
		expect(result.hasMore).toBe(false);
		expect(result.items.map((item) => item.title)).toEqual(["Cafe", "Zoo"]);
		expect(result.items[0].location).toEqual(location);
		expect(mocks.findAvailableEvents).toHaveBeenCalledWith(
			expect.anything(),
			{ subject: "owner" },
			expect.anything(),
			["loc"],
		);
	});

	it("reports more results when a page stops before the combined result set ends", async () => {
		mocks.findAvailableEvents.mockResolvedValue([
			{ kind: "event", id: "b", title: "Same", locationId: "loc" },
			{ kind: "event", id: "a", title: "Same", locationId: "loc" },
		]);
		mocks.findAvailablePlaces.mockResolvedValue([
			{ kind: "place", id: "p", title: "Same", locationId: "loc" },
		]);
		const result = await findAvailability(
			{
				transaction: (run: (tx: object) => Promise<unknown>) => run({}),
			} as never,
			null,
			{ ...query, limit: 1 },
		);
		expect(result.total).toBe(3);
		expect(result.hasMore).toBe(true);
		expect(result.items.map((item) => item.id)).toEqual(["a"]);
	});
});
