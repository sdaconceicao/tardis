import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const boundarySources = {
	"neon-free": {
		file: "cb_2025_us_state_500k.zip",
		url: "https://www2.census.gov/geo/tiger/GENZ2025/shp/cb_2025_us_state_500k.zip",
		sha256: "9cbfe171dad1555e11770c981d8f4db9e687a65c86f5bdae684eeb487e2e9b80",
	},
	"regional-poi": {
		file: "ne_50m_admin_0_countries.zip",
		url: "https://naturalearth.s3.amazonaws.com/50m_cultural/ne_50m_admin_0_countries.zip",
		sha256: "5fed433373581fa648920435f937d95f2d3c0200e067409c6478dcdf1b853139",
	},
	"regional-poi-continents": {
		file: "ne_50m_geography_regions_polys.zip",
		url: "https://naturalearth.s3.amazonaws.com/50m_physical/ne_50m_geography_regions_polys.zip",
		sha256: "a6e7ac257f6f0847ed80e6dc6e776441456652c093cfe90c7bf26dc8069f0d03",
	},
} as const;

export async function boundaryFile(
	directory: string,
	key: keyof typeof boundarySources,
): Promise<string> {
	const source = boundarySources[key];
	const path = join(directory, source.file);
	let bytes: Buffer;
	try {
		bytes = await readFile(path);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		const response = await fetch(source.url, {
			signal: AbortSignal.timeout(120_000),
		});
		if (!response.ok)
			throw new Error(`Boundary download returned ${response.status}`);
		bytes = Buffer.from(await response.arrayBuffer());
		await writeFile(path, bytes);
	}
	if (createHash("sha256").update(bytes).digest("hex") !== source.sha256) {
		throw new Error(`Boundary checksum mismatch: ${source.file}`);
	}
	return path;
}
