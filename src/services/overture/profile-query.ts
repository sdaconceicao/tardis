import { overtureProfiles } from "../../../config/overture/profiles.ts";
import { regionalBoundarySql } from "./regional-boundary-sql.ts";
import type { CategoryMapping } from "./taxonomy.ts";

function quote(value: string): string {
	return `'${value.replaceAll("'", "''")}'`;
}

export function buildProfileQuery(
	urls: string[],
	scope: "regional-poi" | "neon-free",
	mapping: CategoryMapping,
	boundaryFiles?: { us?: string; countries?: string; regions?: string },
): string {
	if (urls.length === 0) throw new Error("No Overture Places files selected");
	const source = `read_parquet([${urls.map(quote).join(", ")}])`;
	const quality = `CASE
		WHEN p.id IS NULL OR p.id = '' THEN 'missing_id'
		WHEN p.names.primary IS NULL OR trim(p.names.primary) = '' THEN 'missing_name'
		ELSE 'accepted' END`;
	const allowedGroups = new Set<string>(
		overtureProfiles[scope].scope.categoryGroups,
	);
	const selected = [...mapping.selected.entries()].filter(([, group]) =>
		allowedGroups.has(group),
	);
	if (selected.length === 0)
		throw new Error("Profile category selection is empty");
	const mapValues = selected
		.map(([id, group]) => `(${quote(id)}, ${quote(group)})`)
		.join(",\n");
	if (scope === "regional-poi") {
		if (!boundaryFiles?.countries || !boundaryFiles.regions)
			throw new Error("Regional profile requires both Natural Earth archives");
		return `${regionalBoundarySql(boundaryFiles.countries, boundaryFiles.regions)}
		WITH category_map(id, category) AS (VALUES ${mapValues})
		SELECT b.region, m.category, ${quality} AS status,
			count(*)::BIGINT AS row_count,
			sum(octet_length(encode(COALESCE(p.id, ''))) + octet_length(encode(COALESCE(p.names.primary, ''))))::BIGINT AS id_name_bytes
		FROM ${source} p
		JOIN category_map m ON m.id = COALESCE(p.taxonomy.primary, p.basic_category)
		JOIN regional_boundary b
			ON p.bbox.xmin BETWEEN b.minx AND b.maxx
			AND p.bbox.ymin BETWEEN b.miny AND b.maxy
			AND ST_Covers(b.geom, p.geometry)
		WHERE ST_GeometryType(p.geometry) = 'POINT'
		GROUP BY 1, 2, 3 ORDER BY 1, 2, 3;`;
	}
	if (!boundaryFiles?.us)
		throw new Error("US profile requires a Census boundary archive");
	const shapefile = `/vsizip/${boundaryFiles.us}/cb_2025_us_state_500k.shp`;
	return `CREATE TEMP TABLE us_states AS
		SELECT STUSPS AS region, geom,
			ST_XMin(geom) AS minx, ST_XMax(geom) AS maxx,
			ST_YMin(geom) AS miny, ST_YMax(geom) AS maxy
		FROM (
			SELECT STUSPS, ST_Transform(geom, 'EPSG:4269', 'EPSG:4326', true) AS geom
			FROM ST_Read(${quote(shapefile)})
			WHERE STATEFP NOT IN ('60', '66', '69', '72', '78')
		);
		WITH category_map(id, category) AS (VALUES ${mapValues})
		SELECT s.region, m.category, ${quality} AS status,
			count(*)::BIGINT AS row_count,
			sum(octet_length(encode(COALESCE(p.id, ''))) + octet_length(encode(COALESCE(p.names.primary, ''))))::BIGINT AS id_name_bytes
		FROM ${source} p
		JOIN category_map m ON m.id = COALESCE(p.taxonomy.primary, p.basic_category)
		JOIN us_states s
			ON p.bbox.xmin BETWEEN s.minx AND s.maxx
			AND p.bbox.ymin BETWEEN s.miny AND s.maxy
			AND ST_Covers(s.geom, ST_Point(p.bbox.xmin, p.bbox.ymin))
		WHERE p.bbox.xmin BETWEEN -180 AND 180
			AND p.bbox.ymin BETWEEN 17 AND 72
		GROUP BY 1, 2, 3 ORDER BY 1, 2, 3;`;
}
