import { and, desc, eq, gt, gte, inArray, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Connection } from "../../db/client.server";
import { excludedLandmarkTaxonomy } from "../../services/overture/landmark-policy.ts";
import {
	locations,
	placeClusterCells,
	placeImportRuns,
	places,
} from "./schema";

async function latestCatalogRun(db: Connection) {
	const [run] = await db
		.select({ id: placeImportRuns.id, state: placeImportRuns.state })
		.from(placeImportRuns)
		.where(inArray(placeImportRuns.profile, ["regional-poi", "neon-free"]))
		.orderBy(desc(placeImportRuns.createdAt))
		.limit(1);
	return run;
}

async function catalogStatus(db: Connection) {
	const run = await latestCatalogRun(db);
	return run?.state === "running"
		? "importing"
		: run?.state === "completed"
			? "ready"
			: "empty";
}

async function cachedClusters(
	db: Connection,
	q: z.infer<typeof clusterQuerySchema>,
	runId: string,
) {
	const factor = 2 ** (7 - q.zoom);
	const cellX = sql<number>`floor(${placeClusterCells.cellX} / ${factor})`;
	const cellY = sql<number>`floor(${placeClusterCells.cellY} / ${factor})`;
	const rows = await db
		.select({
			cellX,
			cellY,
			count: sql<number>`sum(${placeClusterCells.placeCount})::integer`,
			latitude: sql<number>`(sum(${placeClusterCells.latitudeSum}) / sum(${placeClusterCells.placeCount}))::double precision`,
			longitude: sql<number>`(sum(${placeClusterCells.longitudeSum}) / sum(${placeClusterCells.placeCount}))::double precision`,
			west: sql<number>`min(${placeClusterCells.west})::double precision`,
			east: sql<number>`max(${placeClusterCells.east})::double precision`,
			south: sql<number>`min(${placeClusterCells.south})::double precision`,
			north: sql<number>`max(${placeClusterCells.north})::double precision`,
		})
		.from(placeClusterCells)
		.where(
			and(
				eq(placeClusterCells.runId, runId),
				q.category ? eq(placeClusterCells.category, q.category) : undefined,
				lte(placeClusterCells.south, q.north),
				gte(placeClusterCells.north, q.south),
				q.west < q.east
					? and(
							lte(placeClusterCells.west, q.east),
							gte(placeClusterCells.east, q.west),
						)
					: or(
							gte(placeClusterCells.east, q.west),
							lte(placeClusterCells.west, q.east),
						),
			),
		)
		.groupBy(sql`1, 2`)
		.orderBy(sql`1, 2`)
		.limit(501);
	return { clusters: rows.slice(0, 500), capped: rows.length > 500 };
}

const category = z.enum([
	"restaurants",
	"parks",
	"museums",
	"landmarks",
	"entertainment",
]);
const boundsFields = {
	west: z.coerce.number().finite().min(-180).max(180),
	south: z.coerce.number().finite().min(-90).max(90),
	east: z.coerce.number().finite().min(-180).max(180),
	north: z.coerce.number().finite().min(-90).max(90),
};
export const discoveryQuerySchema = z
	.strictObject({
		...boundsFields,
		category: category.optional(),
		limit: z.coerce.number().int().min(1).max(100).default(100),
		cursor: z.uuid().optional(),
	})
	.refine(
		(q) => q.south < q.north && q.west !== q.east,
		"Discovery bounds must have an area",
	);
export const clusterQuerySchema = z
	.strictObject({
		...boundsFields,
		category: category.optional(),
		zoom: z.coerce.number().int().min(0).max(22),
	})
	.refine(
		(q) => q.south < q.north && q.west !== q.east,
		"Discovery bounds must have an area",
	);

type Bounds = Pick<
	z.infer<typeof discoveryQuerySchema>,
	"west" | "south" | "east" | "north"
>;

function between(min: number, max: number, step: number): [number, number][] {
	const slices: [number, number][] = [];
	for (let start = min; start < max; start += step) {
		slices.push([start, Math.min(start + step, max)]);
	}
	return slices;
}

function spatialBounds(q: Bounds) {
	if (q.south >= q.north || q.west === q.east) {
		throw new Error("Discovery bounds must have an area");
	}
	const longitudes =
		q.west < q.east
			? between(q.west, q.east, 90)
			: [...between(q.west, 180, 90), ...between(-180, q.east, 90)];
	const latitudes = between(q.south, q.north, 80);
	return or(
		...longitudes.flatMap(([west, east]) =>
			latitudes.map(
				([south, north]) =>
					sql`ST_Intersects(${locations.point}, ST_MakeEnvelope(${west}, ${south}, ${east}, ${north}, 4326)::geography)`,
			),
		),
	);
}

function boundsCenter(q: Bounds) {
	const longitude =
		q.west < q.east
			? (q.west + q.east) / 2
			: (((q.west + q.east + 360) / 2 + 180) % 360) - 180;
	return { latitude: (q.south + q.north) / 2, longitude };
}

function eligible(categoryFilter?: z.infer<typeof category>) {
	return sql`EXISTS (
		SELECT 1 FROM place_sources source
		JOIN place_import_runs run ON run.id = source.applied_run_id
		WHERE source.place_id = ${places.id}
			AND source.state = 'active'
			AND run.profile IN ('regional-poi', 'neon-free')
			AND (source.operating_status IS NULL OR source.operating_status = 'open')
			AND (source.category <> 'landmarks' OR (source.taxonomy_primary IS NOT NULL AND source.taxonomy_primary <> ${excludedLandmarkTaxonomy}))
			AND ${categoryFilter ? sql`source.category = ${categoryFilter}` : sql`TRUE`}
	)`;
}

export async function listDiscovery(
	db: Connection,
	q: z.infer<typeof discoveryQuerySchema>,
) {
	if (!(await latestCatalogRun(db))) {
		return {
			items: [],
			hasMore: false,
			nextCursor: null,
			catalogStatus: "empty" as const,
		};
	}
	const center = boundsCenter(q);
	const centerPoint = sql`ST_SetSRID(ST_MakePoint(${center.longitude}, ${center.latitude}),4326)::geography`;
	const distance = sql<number>`${locations.point} <-> ${centerPoint}`;
	let cursorDistance: number | undefined;
	if (q.cursor) {
		const [cursor] = await db
			.select({ distance })
			.from(places)
			.innerJoin(locations, eq(places.locationId, locations.id))
			.where(eq(places.id, q.cursor))
			.limit(1);
		if (!cursor) {
			return {
				items: [],
				hasMore: false,
				nextCursor: null,
				catalogStatus: await catalogStatus(db),
			};
		}
		cursorDistance = cursor.distance;
	}
	const rows = await db
		.select({
			id: places.id,
			name: places.name,
			latitude: locations.latitude,
			longitude: locations.longitude,
			address: locations.address,
			category: sql<
				string | null
			>`(SELECT source.category FROM place_sources source JOIN place_import_runs run ON run.id=source.applied_run_id WHERE source.place_id = ${places.id} AND source.state = 'active' AND run.profile IN ('regional-poi', 'neon-free') ORDER BY source.id LIMIT 1)`,
			sourceRelease: sql<
				string | null
			>`(SELECT run.release FROM place_sources source JOIN place_import_runs run ON run.id = source.applied_run_id WHERE source.place_id = ${places.id} AND source.state = 'active' AND run.profile IN ('regional-poi', 'neon-free') ORDER BY source.id LIMIT 1)`,
		})
		.from(places)
		.innerJoin(locations, eq(places.locationId, locations.id))
		.where(
			and(
				eq(places.managementKind, "catalog"),
				eq(places.visibility, "public"),
				eligible(q.category),
				spatialBounds(q),
				q.cursor !== undefined && cursorDistance !== undefined
					? or(
							gt(distance, cursorDistance),
							and(eq(distance, cursorDistance), gt(places.id, q.cursor)),
						)
					: undefined,
			),
		)
		.orderBy(distance, places.id)
		.limit(q.limit + 1);
	const hasMore = rows.length > q.limit;
	const items = rows.slice(0, q.limit).map((row) => ({
		...row,
		source: "Overture Maps",
		hoursState: "unknown" as const,
	}));
	return {
		items,
		hasMore,
		nextCursor: hasMore ? items.at(-1)?.id : null,
		catalogStatus: await catalogStatus(db),
	};
}

export async function clusterDiscovery(
	db: Connection,
	q: z.infer<typeof clusterQuerySchema>,
) {
	const run = await latestCatalogRun(db);
	if (!run) {
		return {
			clusters: [],
			capped: false,
			approximate: false,
			catalogStatus: "empty" as const,
		};
	}
	if (q.zoom <= 5 && run?.state === "completed") {
		const [cell] = await db
			.select({ runId: placeClusterCells.runId })
			.from(placeClusterCells)
			.where(eq(placeClusterCells.runId, run.id))
			.limit(1);
		if (cell) {
			return {
				...(await cachedClusters(db, q, run.id)),
				approximate: true,
				catalogStatus: "ready" as const,
			};
		}
	}
	const cellSize = 360 / 2 ** (q.zoom + 2);
	const cellX = sql<number>`floor((${locations.longitude} + 180) / ${cellSize})`;
	const cellY = sql<number>`floor((${locations.latitude} + 90) / ${cellSize})`;
	const rows = await db
		.select({
			cellX,
			cellY,
			count: sql<number>`count(*)::integer`,
			latitude: sql<number>`avg(${locations.latitude})::double precision`,
			longitude: sql<number>`avg(${locations.longitude})::double precision`,
			west: sql<number>`min(${locations.longitude})::double precision`,
			east: sql<number>`max(${locations.longitude})::double precision`,
			south: sql<number>`min(${locations.latitude})::double precision`,
			north: sql<number>`max(${locations.latitude})::double precision`,
		})
		.from(places)
		.innerJoin(locations, eq(places.locationId, locations.id))
		.where(
			and(
				eq(places.managementKind, "catalog"),
				eq(places.visibility, "public"),
				eligible(q.category),
				spatialBounds(q),
			),
		)
		.groupBy(sql`1, 2`)
		.orderBy(sql`1, 2`)
		.limit(501);
	return {
		clusters: rows.slice(0, 500),
		capped: rows.length > 500,
		approximate: false,
		catalogStatus: await catalogStatus(db),
	};
}
