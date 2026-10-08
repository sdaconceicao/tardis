import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export const overtureRelease = "2026-09-23.1";
export const collectionUrl = `https://stac.overturemaps.org/${overtureRelease}/places/place/collection.json`;
const pinnedManifestSha256 =
	"00e55248833cc877cf0722d3fef7bff27366590d615be3feb178bfd87c514e67";

export type PlaceAsset = {
	id: string;
	url: string;
	bbox: [number, number, number, number];
	rows: number;
	bytes: number;
};

function object(value: unknown): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("Invalid Overture STAC object");
	}
	return value as Record<string, unknown>;
}

function positiveInteger(value: unknown): number {
	if (!Number.isSafeInteger(value) || (value as number) <= 0) {
		throw new Error("Invalid Overture STAC count");
	}
	return value as number;
}

function assetUrl(value: unknown): string {
	if (typeof value !== "string") throw new Error("Missing Overture asset URL");
	const url = new URL(value);
	if (
		url.protocol !== "https:" ||
		url.hostname !== "overturemaps-us-west-2.s3.us-west-2.amazonaws.com" ||
		!url.pathname.startsWith(
			`/release/${overtureRelease}/theme=places/type=place/`,
		) ||
		!url.pathname.endsWith(".parquet")
	) {
		throw new Error(`Unexpected Overture asset URL: ${value}`);
	}
	return value;
}

export function parsePlaceManifest(
	collection: unknown,
	items: unknown[],
): PlaceAsset[] {
	const root = object(collection);
	const fileCount = positiveInteger(root["partition:file_count"]);
	const rowCount = positiveInteger(root["table:row_count"]);
	const links = root.links;
	if (!Array.isArray(links)) throw new Error("Missing Overture item links");
	const itemLinks = links.filter((link) => object(link).rel === "item");
	if (fileCount !== itemLinks.length || fileCount !== items.length) {
		throw new Error("Incomplete Overture Places manifest");
	}
	const linkedIds = new Set(
		itemLinks.map((link) => {
			const href = object(link).href;
			if (typeof href !== "string")
				throw new Error("Invalid Overture item link");
			return new URL(href).pathname
				.split("/")
				.at(-1)
				?.replace(/\.json$/, "");
		}),
	);
	if (linkedIds.size !== fileCount)
		throw new Error("Duplicate Overture item link");
	const urls = new Set<string>();
	const ids = new Set<string>();
	const assets = items.map((rawItem) => {
		const item = object(rawItem);
		if (
			typeof item.id !== "string" ||
			!linkedIds.has(item.id) ||
			ids.has(item.id)
		) {
			throw new Error("Overture item does not match the manifest links");
		}
		ids.add(item.id);
		const bbox = item.bbox;
		if (
			!Array.isArray(bbox) ||
			bbox.length !== 4 ||
			!bbox.every(
				(coordinate) =>
					typeof coordinate === "number" && Number.isFinite(coordinate),
			) ||
			bbox[0] > bbox[2] ||
			bbox[1] > bbox[3]
		) {
			throw new Error("Invalid Overture asset bounding box");
		}
		const url = assetUrl(object(object(item.assets).aws).href);
		if (urls.has(url)) throw new Error("Duplicate Overture asset URL");
		urls.add(url);
		return {
			id: item.id,
			url,
			bbox: bbox as [number, number, number, number],
			rows: positiveInteger(object(item.properties).num_rows),
			bytes: positiveInteger(object(object(item.assets).aws)["file:size"]),
		};
	});
	if (assets.reduce((total, asset) => total + asset.rows, 0) !== rowCount) {
		throw new Error("Overture manifest row counts do not add up");
	}
	return assets;
}

export async function fetchPlaceManifest(): Promise<PlaceAsset[]> {
	async function json(url: string): Promise<unknown> {
		const response = await fetch(url);
		if (!response.ok)
			throw new Error(`Overture STAC returned ${response.status}: ${url}`);
		return response.json();
	}
	const collection = object(await json(collectionUrl));
	const links = collection.links;
	if (!Array.isArray(links)) throw new Error("Missing Overture item links");
	const itemUrls = links
		.filter((link) => object(link).rel === "item")
		.map((link) => {
			const href = object(link).href;
			if (typeof href !== "string")
				throw new Error("Invalid Overture item link");
			const url = new URL(href);
			if (
				url.protocol !== "https:" ||
				url.hostname !== "stac.overturemaps.org" ||
				!url.pathname.startsWith(`/${overtureRelease}/places/place/`)
			) {
				throw new Error(`Unexpected Overture item link: ${href}`);
			}
			return href;
		});
	return parsePlaceManifest(collection, await Promise.all(itemUrls.map(json)));
}

export async function loadPinnedPlaceManifest(): Promise<PlaceAsset[]> {
	const bytes = await readFile(
		new URL(
			`../../../config/overture/manifest-${overtureRelease}.json`,
			import.meta.url,
		),
	);
	if (
		createHash("sha256").update(bytes).digest("hex") !== pinnedManifestSha256
	) {
		throw new Error("Pinned Overture Places manifest checksum mismatch");
	}
	const assets: unknown = JSON.parse(bytes.toString("utf8"));
	if (!Array.isArray(assets) || assets.length !== 16) {
		throw new Error("Invalid pinned Overture Places manifest");
	}
	return assets as PlaceAsset[];
}
