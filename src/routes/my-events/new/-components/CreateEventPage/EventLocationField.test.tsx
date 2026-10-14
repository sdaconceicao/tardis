// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCallback, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlaceSuggestion } from "./CreateEventPage.hooks";
import { initialDraft } from "./CreateEventPage.utils";
import { EventLocationField } from "./EventLocationField";

const poi = {
	id: "11111111-1111-4111-8111-111111111111",
	name: "Town square",
	address: "12 Main Street, Philadelphia, PA",
	latitude: 39.95,
	longitude: -75.15,
	timezone: "America/New_York",
};
const matchedAddress = {
	line1: "12 Main Street",
	line2: "",
	city: "Philadelphia",
	region: "Pennsylvania",
	postalCode: "19106",
	country: "United States",
};
const loadSuggestions = vi.fn<(query: string) => Promise<PlaceSuggestion[]>>();

function LocationHarness() {
	const [draft, setDraft] = useState(initialDraft);
	const updateLocation = useCallback(
		(change: (previous: typeof draft.location) => typeof draft.location) => {
			setDraft((previous) => ({
				...previous,
				location: change(previous.location),
			}));
		},
		[],
	);
	return (
		<>
			<EventLocationField
				draft={draft}
				updateLocation={updateLocation}
				loadPlaceSuggestions={loadSuggestions}
			/>
			<output data-testid="location-state">
				{JSON.stringify(draft.location)}
			</output>
		</>
	);
}

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
	vi.clearAllMocks();
});

describe("event location fields", () => {
	it("requires choosing a match and invalidates it after an address edit", async () => {
		const user = userEvent.setup();
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				Response.json([
					{
						id: "address:1",
						label: "12 Main Street, Philadelphia",
						address: matchedAddress,
						latitude: 39.95,
						longitude: -75.15,
						timezone: "America/New_York",
					},
				]),
			),
		);
		render(<LocationHarness />);
		await user.type(
			screen.getByRole("textbox", { name: "Location name" }),
			"Hall",
		);
		await user.type(
			screen.getByRole("textbox", { name: "Address line 1" }),
			"12 Main Street",
		);
		await user.type(
			screen.getByRole("textbox", { name: "City" }),
			"Philadelphia",
		);
		await user.type(
			screen.getByRole("textbox", { name: "State or region" }),
			"Pennsylvania",
		);
		await user.type(
			screen.getByRole("textbox", { name: "Country" }),
			"United States",
		);
		await user.click(screen.getByRole("button", { name: "Find Address" }));
		await user.click(
			await screen.findByRole("option", {
				name: "12 Main Street, Philadelphia",
			}),
		);
		expect(screen.getByTestId("location-state").textContent).toContain(
			'"source":"address"',
		);
		await user.type(
			screen.getByRole("textbox", { name: "Address line 1" }),
			" Annex",
		);
		expect(screen.getByTestId("location-state").textContent).toContain(
			'"match":null',
		);
	});

	it("fills address fields when a POI is selected", async () => {
		const user = userEvent.setup();
		loadSuggestions.mockResolvedValue([
			{ id: poi.id, label: poi.name, place: poi },
		]);
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(Response.json(matchedAddress)),
		);
		render(<LocationHarness />);
		await user.type(
			screen.getByRole("searchbox", { name: "Search Places" }),
			"Town square",
		);
		await user.click(
			await screen.findByRole("option", { name: /Town square/ }),
		);
		await waitFor(() =>
			expect(
				screen.getByRole("textbox", { name: "Address line 1" }),
			).toHaveProperty("value", "12 Main Street"),
		);
		expect(screen.getByTestId("location-state").textContent).toContain(
			`"id":"${poi.id}"`,
		);
		await user.type(
			screen.getByRole("textbox", { name: "Location name" }),
			" Annex",
		);
		expect(screen.getByTestId("location-state").textContent).toContain(
			'"poi":null',
		);
		expect(screen.getByTestId("location-state").textContent).toContain(
			'"source":"poi"',
		);
	});
});
