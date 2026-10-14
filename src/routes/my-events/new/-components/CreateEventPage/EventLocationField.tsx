import {
	Button,
	DropdownItem,
	DropdownListBox,
	SearchField,
	TextField,
} from "@code-x/lago";
import type { CreateEventController } from "./CreateEventPage.hooks";
import css from "./CreateEventPage.module.css";
import { useEventLocationField } from "./EventLocationField.hooks";

type Props = Pick<
	CreateEventController,
	"draft" | "updateLocation" | "loadPlaceSuggestions"
>;

export function EventLocationField({
	draft,
	updateLocation,
	loadPlaceSuggestions,
}: Props) {
	const location = draft.location;
	const {
		query,
		setQuery,
		results,
		loading,
		matches,
		lookingUp,
		enriching,
		error,
		updateField,
		selectPoi,
		clearPoi,
		findAddress,
		selectMatch,
	} = useEventLocationField(location, updateLocation, loadPlaceSuggestions);
	const needsAddress = !location.poi && location.match?.source !== "poi";
	const canFindAddress = Boolean(
		location.address.line1 &&
			location.address.city &&
			location.address.region &&
			location.address.country,
	);

	return (
		<section className={css.panel} aria-labelledby="venue-heading">
			<h2 id="venue-heading">Location</h2>
			<p>Search for a place or enter an address below.</p>
			<div className={css.placeSearch}>
				<SearchField
					label="Search Places"
					value={query}
					onChange={setQuery}
					placeholder="Venue name or address"
				/>
				{query.trim().length >= 3 && (
					<DropdownListBox
						aria-label="Place suggestions"
						items={results}
						onAction={(key) => {
							const place = results.find((result) => result.id === key)?.place;
							if (place) void selectPoi(place);
						}}
						renderEmptyState={() =>
							loading
								? "Searching…"
								: "No places found. Enter an address below."
						}
					>
						{(suggestion) => (
							<DropdownItem id={suggestion.id} textValue={suggestion.label}>
								<span className={css.suggestion}>
									<strong>{suggestion.place.name}</strong>
									<span>
										{suggestion.place.address ||
											`${suggestion.place.latitude}, ${suggestion.place.longitude}`}
									</span>
								</span>
							</DropdownItem>
						)}
					</DropdownListBox>
				)}
			</div>
			{location.poi && (
				<div className={css.selectedPoi}>
					<div>
						<strong>Selected place: {location.poi.name}</strong>
						<span>
							{location.poi.address || "No street address is available."}
						</span>
					</div>
					<Button variant="quiet" type="button" onPress={clearPoi}>
						Clear selection
					</Button>
				</div>
			)}
			<div className={css.addressFields}>
				<TextField
					label="Location name"
					value={location.name}
					onChange={(value) => updateField("name", value)}
					isRequired
					maxLength={200}
				/>
				<TextField
					label="Address line 1"
					value={location.address.line1}
					onChange={(value) => updateField("line1", value)}
					isRequired={needsAddress}
					maxLength={200}
				/>
				<TextField
					label="Address line 2"
					value={location.address.line2}
					onChange={(value) => updateField("line2", value)}
					maxLength={200}
				/>
				<div className={css.addressRow}>
					<TextField
						label="City"
						value={location.address.city}
						onChange={(value) => updateField("city", value)}
						isRequired={needsAddress}
						maxLength={200}
					/>
					<TextField
						label="State or region"
						value={location.address.region}
						onChange={(value) => updateField("region", value)}
						isRequired={needsAddress}
						maxLength={200}
					/>
				</div>
				<div className={css.addressRow}>
					<TextField
						label="Postal code"
						value={location.address.postalCode}
						onChange={(value) => updateField("postalCode", value)}
						maxLength={40}
					/>
					<TextField
						label="Country"
						value={location.address.country}
						onChange={(value) => updateField("country", value)}
						isRequired={needsAddress}
						maxLength={200}
					/>
				</div>
			</div>
			{enriching && <p role="status">Filling address fields…</p>}
			{!location.poi && (
				<div className={css.addressLookup}>
					<Button
						variant="secondary"
						type="button"
						isPending={lookingUp}
						isDisabled={!canFindAddress || lookingUp}
						onPress={() => void findAddress()}
					>
						Find Address
					</Button>
					{location.match && (
						<p role="status">Selected address: {location.match.label}</p>
					)}
				</div>
			)}
			{matches.length > 0 && (
				<DropdownListBox
					aria-label="Address matches"
					items={matches.map((match, index) => ({
						id: String(index),
						label: match.label,
						match,
					}))}
					onAction={(key) => {
						const match = matches[Number(key)];
						if (match) selectMatch(match);
					}}
				>
					{(item) => (
						<DropdownItem id={item.id} textValue={item.label}>
							{item.label}
						</DropdownItem>
					)}
				</DropdownListBox>
			)}
			{error && (
				<p className={css.locationError} role="alert">
					{error}
				</p>
			)}
		</section>
	);
}
