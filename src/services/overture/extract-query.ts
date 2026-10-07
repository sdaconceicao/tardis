import { overtureProfiles } from "../../../config/overture/profiles.ts";
import { regionalBoundarySql } from "./regional-boundary-sql.ts";
import type { CategoryMapping } from "./taxonomy.ts";

function quote(value: string): string {
	return `'${value.replaceAll("'", "''")}'`;
}

export function buildExtractSql(
	assetUrl: string,
	outputPath: string,
	scope: "regional-poi" | "neon-free",
	mapping: CategoryMapping,
	boundaryFiles?: { us?: string; countries?: string; regions?: string },
	maxRows?: number,
): string {
	if (
		maxRows !== undefined &&
		(!Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > 1000)
	) {
		throw new Error("Extraction smoke limit must be between 1 and 1000");
	}
	const limit = maxRows ? ` LIMIT ${maxRows}` : "";
	const source = `read_parquet(${quote(assetUrl)})`;
	const columns = `
		p.id,
		p.names.primary AS name,
		CASE WHEN ST_GeometryType(p.geometry) = 'POINT' THEN ST_Y(p.geometry) ELSE NULL END AS latitude,
		CASE WHEN ST_GeometryType(p.geometry) = 'POINT' THEN ST_X(p.geometry) ELSE NULL END AS longitude,
		p.addresses[1].freeform AS address,
		p.taxonomy.primary AS taxonomyPrimary,
		p.basic_category AS basicCategory,
		p.operating_status AS operatingStatus,
		p.confidence,
		p.sources`;
	const allowed = new Set<string>(overtureProfiles[scope].scope.categoryGroups);
	const values = [...mapping.selected.entries()]
		.filter(([, group]) => allowed.has(group))
		.map(([id, group]) => `(${quote(id)}, ${quote(group)})`);
	if (values.length === 0)
		throw new Error("Extraction category selection is empty");
	if (scope === "regional-poi") {
		if (!boundaryFiles?.countries || !boundaryFiles.regions)
			throw new Error(
				"Regional extraction requires both Natural Earth archives",
			);
		return `${regionalBoundarySql(boundaryFiles.countries, boundaryFiles.regions)}
		COPY (
			WITH category_map(id, category) AS (VALUES ${values.join(", ")})
			SELECT ${columns}
			FROM ${source} p
			JOIN category_map m ON m.id = COALESCE(p.taxonomy.primary, p.basic_category)
			WHERE ST_GeometryType(p.geometry) = 'POINT'
				AND EXISTS (
					SELECT 1 FROM regional_boundary b
					WHERE p.bbox.xmin BETWEEN b.minx AND b.maxx
						AND p.bbox.ymin BETWEEN b.miny AND b.maxy
						AND ST_Covers(b.geom, p.geometry)
				)${limit}
		) TO ${quote(outputPath)} (FORMAT JSON, ARRAY false, COMPRESSION GZIP);`;
	}
	if (!boundaryFiles?.us)
		throw new Error("US extraction requires a Census boundary archive");
	const shapefile = `/vsizip/${boundaryFiles.us}/cb_2025_us_state_500k.shp`;
	return `CREATE TEMP TABLE us_states AS
		SELECT ST_Transform(geom, 'EPSG:4269', 'EPSG:4326', true) AS geom
		FROM ST_Read(${quote(shapefile)})
		WHERE STATEFP NOT IN ('60', '66', '69', '72', '78');
		COPY (
			WITH category_map(id, category) AS (VALUES ${values.join(", ")})
			SELECT ${columns}
			FROM ${source} p
			JOIN category_map m ON m.id = COALESCE(p.taxonomy.primary, p.basic_category)
			JOIN us_states s ON ST_Covers(s.geom, p.geometry)
			WHERE p.bbox.xmin BETWEEN -180 AND 180
				AND p.bbox.ymin BETWEEN 17 AND 72
				AND ST_GeometryType(p.geometry) = 'POINT'${limit}
		) TO ${quote(outputPath)} (FORMAT JSON, ARRAY false, COMPRESSION GZIP);`;
}
