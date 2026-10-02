import type { Database } from "../../db/client.server";
import type { AvailabilityQuery } from "../../shared/validation";
import { findAvailableEvents } from "../events/index.server";
import type { Actor } from "../identity/contracts";
import { findAvailablePlaces, nearbyLocations } from "../places/index.server";

export async function findAvailability(
	db: Database,
	actor: Actor | null,
	query: AvailabilityQuery,
) {
	// A consistent snapshot keeps schedule and visibility edits from mixing within one response.
	return db.transaction(
		async (tx) => {
			const locations = await nearbyLocations(tx, query);
			const ids = locations.map((l) => l.id);
			const locationById = new Map(locations.map((l) => [l.id, l]));
			const [events, places] = await Promise.all([
				findAvailableEvents(tx, actor, query, ids),
				findAvailablePlaces(tx, actor, query, ids),
			]);
			const results = [...events, ...places].sort(
				(a, b) =>
					a.title.localeCompare(b.title) ||
					a.kind.localeCompare(b.kind) ||
					a.id.localeCompare(b.id),
			);
			return {
				at: query.at.toISOString(),
				items: results
					.slice(query.offset, query.offset + query.limit)
					.map((item) => ({
						...item,
						location: locationById.get(item.locationId),
					})),
				total: results.length,
				hasMore: results.length > query.offset + query.limit,
			};
		},
		{ isolationLevel: "repeatable read", accessMode: "read only" },
	);
}
