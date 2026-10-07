import { z } from "zod";

export const fallbackViewport = {
	west: -130,
	south: 20,
	east: -60,
	north: 55,
	zoom: 3,
};

const searchSchema = z
	.object({
		west: z.coerce.number().finite().min(-180).max(180).optional(),
		south: z.coerce.number().finite().min(-90).max(90).optional(),
		east: z.coerce.number().finite().min(-180).max(180).optional(),
		north: z.coerce.number().finite().min(-90).max(90).optional(),
		zoom: z.coerce.number().finite().min(0).max(22).optional(),
		category: z
			.enum(["museums", "entertainment", "landmarks", "parks", "restaurants"])
			.optional(),
		poi: z.uuid().optional(),
	})
	.refine((value) => {
		const bounds = { ...fallbackViewport, ...value };
		return bounds.south < bounds.north && bounds.west !== bounds.east;
	});

export type MapSearch = z.infer<typeof searchSchema>;

export function parseMapSearch(input: Record<string, unknown>): MapSearch {
	const parsed = searchSchema.safeParse(input);
	return parsed.success ? parsed.data : {};
}
