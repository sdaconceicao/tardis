import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
	type AddressMatch,
	addressMatchSchema,
	emptyPostalAddress,
	type PostalAddress,
	postalAddressSchema,
} from "../../../../../modules/places/geocoding";
import type { PlaceSuggestion } from "./CreateEventPage.hooks";
import type { EventLocation, SelectedPoi } from "./CreateEventPage.utils";

export function usePlaceSearch(
	loadSuggestions: (query: string) => Promise<PlaceSuggestion[]>,
) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<PlaceSuggestion[]>([]);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (query.trim().length < 3) {
			setResults([]);
			setLoading(false);
			return;
		}
		let current = true;
		setResults([]);
		setLoading(true);
		const timer = setTimeout(() => {
			loadSuggestions(query)
				.then((suggestions) => {
					if (current) setResults(suggestions);
				})
				.catch(() => {
					if (current) setResults([]);
				})
				.finally(() => {
					if (current) setLoading(false);
				});
		}, 300);
		return () => {
			current = false;
			clearTimeout(timer);
		};
	}, [query, loadSuggestions]);

	return { query, setQuery, results, loading };
}

type UpdateLocation = (
	change: (previous: EventLocation) => EventLocation,
) => void;

async function getJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
	const response = await fetch(url, { credentials: "same-origin" });
	if (!response.ok) {
		const body = await response.json().catch(() => null);
		throw new Error(body?.error ?? "Address lookup failed. Try again.");
	}
	return schema.parse(await response.json());
}

function mergedAddress(
	entered: PostalAddress,
	matched: PostalAddress,
): PostalAddress {
	return {
		line1: matched.line1 || entered.line1,
		line2: entered.line2,
		city: matched.city || entered.city,
		region: matched.region || entered.region,
		postalCode: matched.postalCode || entered.postalCode,
		country: matched.country || entered.country,
	};
}

export function useEventLocationField(
	location: EventLocation,
	updateLocation: UpdateLocation,
	loadSuggestions: (query: string) => Promise<PlaceSuggestion[]>,
) {
	const search = usePlaceSearch(loadSuggestions);
	const [matches, setMatches] = useState<AddressMatch[]>([]);
	const [lookingUp, setLookingUp] = useState(false);
	const [enriching, setEnriching] = useState(false);
	const [error, setError] = useState("");
	const requestId = useRef(0);

	const updateField = useCallback(
		(field: "name" | keyof PostalAddress, value: string) => {
			requestId.current += 1;
			setMatches([]);
			setError("");
			setLookingUp(false);
			setEnriching(false);
			updateLocation((previous) => {
				if (field === "name") {
					const match = previous.poi
						? {
								id: `poi:${previous.poi.id}`,
								label: previous.poi.address ?? "",
								address: previous.address,
								latitude: previous.poi.latitude,
								longitude: previous.poi.longitude,
								timezone: previous.poi.timezone,
								source: "poi" as const,
							}
						: previous.match;
					return { ...previous, name: value, poi: null, match };
				}
				return {
					...previous,
					address: { ...previous.address, [field]: value },
					poi: null,
					match: null,
				};
			});
		},
		[updateLocation],
	);

	const selectPoi = useCallback(
		async (poi: SelectedPoi) => {
			const currentRequest = ++requestId.current;
			search.setQuery("");
			setMatches([]);
			setError("");
			setEnriching(true);
			updateLocation(() => ({
				name: poi.name,
				address: emptyPostalAddress(),
				poi,
				match: null,
			}));
			const parameters = new URLSearchParams({
				latitude: String(poi.latitude),
				longitude: String(poi.longitude),
			});
			if (poi.address) parameters.set("address", poi.address);
			try {
				const address = await getJson(
					`/api/v1/addresses/poi?${parameters}`,
					postalAddressSchema,
				);
				if (currentRequest !== requestId.current) return;
				updateLocation((previous) =>
					previous.poi?.id === poi.id ? { ...previous, address } : previous,
				);
			} catch {
				if (currentRequest === requestId.current)
					setError("Could not fill the address fields for this place.");
			} finally {
				if (currentRequest === requestId.current) setEnriching(false);
			}
		},
		[search.setQuery, updateLocation],
	);

	const clearPoi = useCallback(() => {
		requestId.current += 1;
		setError("");
		setEnriching(false);
		updateLocation((previous) => ({ ...previous, poi: null, match: null }));
	}, [updateLocation]);

	const findAddress = useCallback(async () => {
		const currentRequest = ++requestId.current;
		setError("");
		setMatches([]);
		setLookingUp(true);
		updateLocation((previous) => ({ ...previous, poi: null, match: null }));
		try {
			const parameters = new URLSearchParams(location.address);
			const results = await getJson(
				`/api/v1/addresses/search?${parameters}`,
				z.array(addressMatchSchema),
			);
			if (currentRequest !== requestId.current) return;
			setMatches(results);
			if (!results.length)
				setError("No address matches found. Check the fields and try again.");
		} catch (cause) {
			if (currentRequest === requestId.current)
				setError(
					cause instanceof Error ? cause.message : "Address lookup failed.",
				);
		} finally {
			if (currentRequest === requestId.current) setLookingUp(false);
		}
	}, [location.address, updateLocation]);

	const selectMatch = useCallback(
		(match: AddressMatch) => {
			setMatches([]);
			setError("");
			updateLocation((previous) => ({
				...previous,
				address: mergedAddress(previous.address, match.address),
				poi: null,
				match: { ...match, source: "address" },
			}));
		},
		[updateLocation],
	);

	return {
		...search,
		matches,
		lookingUp,
		enriching,
		error,
		updateField,
		selectPoi,
		clearPoi,
		findAddress,
		selectMatch,
	};
}
