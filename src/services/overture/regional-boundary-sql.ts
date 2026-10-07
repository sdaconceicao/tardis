function quote(value: string): string {
	return `'${value.replaceAll("'", "''")}'`;
}

export function regionalBoundarySql(
	countriesZip: string,
	regionsZip: string,
): string {
	const countries = `/vsizip/${countriesZip}/ne_50m_admin_0_countries.shp`;
	const regions = `/vsizip/${regionsZip}/ne_50m_geography_regions_polys.shp`;
	return `CREATE TEMP TABLE regional_boundary AS
		SELECT 'North America' AS region,
			ST_Union_Agg(ST_SetCRS(geom, 'OGC:CRS84')) AS geom
		FROM ST_Read(${quote(countries)}) WHERE CONTINENT = 'North America'
		UNION ALL
		SELECT 'Europe' AS region,
			ST_Union_Agg(ST_SetCRS(geom, 'OGC:CRS84')) AS geom
		FROM (
			SELECT geom FROM ST_Read(${quote(countries)})
			WHERE CONTINENT = 'Europe' AND NAME <> 'Russia'
			UNION ALL
			SELECT geom FROM ST_Read(${quote(regions)})
			WHERE FEATURECLA = 'Continent' AND NAME = 'EUROPE'
		);
		ALTER TABLE regional_boundary ADD COLUMN minx DOUBLE;
		ALTER TABLE regional_boundary ADD COLUMN maxx DOUBLE;
		ALTER TABLE regional_boundary ADD COLUMN miny DOUBLE;
		ALTER TABLE regional_boundary ADD COLUMN maxy DOUBLE;
		UPDATE regional_boundary SET minx=ST_XMin(geom), maxx=ST_XMax(geom),
			miny=ST_YMin(geom), maxy=ST_YMax(geom);`;
}
