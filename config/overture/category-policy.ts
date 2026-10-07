export const categoryPolicy = {
	restaurants: [
		"restaurant",
		"fast_food_restaurant",
		"fondue_restaurant",
		"bistro",
		"diner",
		"gastropub",
	],
	parks: [
		"park",
		"garden",
		"nature_reserve",
		"recreational_trail_or_path",
		"sculpture_park",
	],
	museums: ["museum"],
	landmarks: [
		"historic_site",
		"memorial_site",
		"religious_landmark",
		"scenic_viewpoint",
		"sculpture_statue",
		"lookout",
	],
	entertainment: [
		"movie_theater",
		"performing_arts_venue",
		"amusement_attraction",
		"stadium_arena",
		"event_venue",
		"festival_venue",
	],
} as const;

export const excludedCategoryRoots = [
	"gas_station",
	"corporate_or_business_office",
	"parking",
	"cemetery",
	"ticket_office_or_booth",
] as const;
