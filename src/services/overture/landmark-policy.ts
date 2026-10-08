// Overture's generic historic_site label includes ordinary residences and businesses.
// Specific descendants such as castles, forts, and lighthouses remain eligible.
export const excludedLandmarkTaxonomy = "historic_site";

export function isLandmarkCandidate(
	category: string | null,
	taxonomyPrimary: string | null,
): boolean {
	return !(
		category === "landmarks" &&
		(!taxonomyPrimary || taxonomyPrimary === excludedLandmarkTaxonomy)
	);
}
