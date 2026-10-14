import { find as findTimezones } from "geo-tz/dist/find-1970";
import { z } from "zod";
import { getServerEnv } from "../../config/env.server";
import { DomainError } from "../../shared/errors";
import {
	type AddressMatch,
	emptyPostalAddress,
	formatPostalAddress,
	type PostalAddress,
} from "./geocoding";

const peliasFeatureSchema = z.object({
	geometry: z.object({ coordinates: z.tuple([z.number(), z.number()]) }),
	properties: z.object({
		gid: z.string().nullish(),
		label: z.string().nullish(),
		name: z.string().nullish(),
		housenumber: z.string().nullish(),
		street: z.string().nullish(),
		locality: z.string().nullish(),
		localadmin: z.string().nullish(),
		region: z.string().nullish(),
		postalcode: z.string().nullish(),
		country: z.string().nullish(),
	}),
});
const peliasResponseSchema = z.object({
	features: z.array(peliasFeatureSchema),
});
type Feature = z.infer<typeof peliasFeatureSchema>;

function addressFromFeature(feature: Feature): PostalAddress {
	const p = feature.properties;
	return {
		line1: [p.housenumber, p.street].filter(Boolean).join(" "),
		line2: "",
		city: p.locality ?? p.localadmin ?? "",
		region: p.region ?? "",
		postalCode: p.postalcode ?? "",
		country: p.country ?? "",
	};
}

async function requestPelias(path: string, parameters: Record<string, string>) {
	const key = getServerEnv().OPENROUTESERVICE_API_KEY;
	if (!key) throw new DomainError(503, "Address lookup is not configured.");
	const url = new URL(`https://api.heigit.org/pelias/v1/${path}`);
	url.searchParams.set("api_key", key);
	for (const [name, value] of Object.entries(parameters))
		url.searchParams.set(name, value);
	try {
		const response = await fetch(url, {
			headers: { Accept: "application/json" },
			signal: AbortSignal.timeout(8000),
		});
		if (!response.ok)
			throw new DomainError(
				response.status === 429 ? 503 : 502,
				response.status === 429
					? "Address lookup is busy. Try again shortly."
					: "Address lookup is unavailable. Try again shortly.",
			);
		return peliasResponseSchema.parse(await response.json()).features;
	} catch (error) {
		if (error instanceof DomainError) throw error;
		throw new DomainError(
			502,
			"Address lookup is unavailable. Try again shortly.",
		);
	}
}

function distanceMetres(
	longitudeA: number,
	latitudeA: number,
	longitudeB: number,
	latitudeB: number,
) {
	const radians = Math.PI / 180;
	const latDelta = (latitudeB - latitudeA) * radians;
	const lonDelta = (longitudeB - longitudeA) * radians;
	const a =
		Math.sin(latDelta / 2) ** 2 +
		Math.cos(latitudeA * radians) *
			Math.cos(latitudeB * radians) *
			Math.sin(lonDelta / 2) ** 2;
	return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(a)));
}

function addressMatchesSource(source: string, feature: Feature) {
	const words = (value: string) =>
		value
			.normalize("NFKD")
			.toLowerCase()
			.replace(/[\u0300-\u036f]/g, "")
			.replace(/[^a-z0-9]+/g, " ")
			.trim()
			.split(/\s+/);
	const sourceWords = new Set(words(source));
	const { housenumber, street } = feature.properties;
	if (!street || (housenumber && !sourceWords.has(housenumber.toLowerCase())))
		return false;
	const streetSuffixes = new Set([
		"avenue",
		"ave",
		"boulevard",
		"blvd",
		"drive",
		"dr",
		"lane",
		"ln",
		"road",
		"rd",
		"street",
		"st",
	]);
	const streetWords = words(street).filter(
		(word) => word.length > 2 && !streetSuffixes.has(word),
	);
	return (
		streetWords.length > 0 && streetWords.every((word) => sourceWords.has(word))
	);
}

export async function searchAddresses(
	address: PostalAddress,
): Promise<AddressMatch[]> {
	const features = await requestPelias("search", {
		text: formatPostalAddress(address),
		size: "5",
	});
	return features.flatMap((feature, index) => {
		const [longitude, latitude] = feature.geometry.coordinates;
		const timezone = findTimezones(latitude, longitude)[0];
		if (!timezone || timezone.startsWith("Etc/GMT")) return [];
		return [
			{
				id: feature.properties.gid ?? String(index),
				label: feature.properties.label ?? formatPostalAddress(address),
				address: addressFromFeature(feature),
				latitude,
				longitude,
				timezone,
			},
		];
	});
}

export async function lookupPoiAddress(query: {
	latitude: number;
	longitude: number;
	address?: string;
}): Promise<PostalAddress> {
	if (query.address) {
		const features = await requestPelias("search", {
			text: query.address,
			"focus.point.lat": String(query.latitude),
			"focus.point.lon": String(query.longitude),
			size: "5",
		});
		const nearby = features.find(
			(feature) =>
				addressMatchesSource(query.address ?? "", feature) &&
				distanceMetres(
					query.longitude,
					query.latitude,
					feature.geometry.coordinates[0],
					feature.geometry.coordinates[1],
				) <= 200,
		);
		if (nearby) return addressFromFeature(nearby);
	}
	const features = await requestPelias("reverse", {
		"point.lat": String(query.latitude),
		"point.lon": String(query.longitude),
		size: "1",
	});
	const nearest = features[0];
	if (!nearest) return emptyPostalAddress();
	const address = addressFromFeature(nearest);
	return { ...address, line1: "" };
}
