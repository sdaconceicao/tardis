import { z } from "zod";

export const postalAddressSchema = z.strictObject({
	line1: z.string().trim().max(200),
	line2: z.string().trim().max(200),
	city: z.string().trim().max(200),
	region: z.string().trim().max(200),
	postalCode: z.string().trim().max(40),
	country: z.string().trim().max(200),
});

export type PostalAddress = z.infer<typeof postalAddressSchema>;

export const emptyPostalAddress = (): PostalAddress => ({
	line1: "",
	line2: "",
	city: "",
	region: "",
	postalCode: "",
	country: "",
});

export const addressSearchQuerySchema = postalAddressSchema.refine(
	(address) =>
		Boolean(address.line1 && address.city && address.region && address.country),
	"Enter address line 1, city, state or region, and country.",
);

export const poiAddressQuerySchema = z.strictObject({
	latitude: z.coerce.number().finite().min(-90).max(90),
	longitude: z.coerce.number().finite().min(-180).max(180),
	address: z.string().trim().max(1000).optional(),
});

export const addressMatchSchema = z.strictObject({
	id: z.string(),
	label: z.string(),
	address: postalAddressSchema,
	latitude: z.number().min(-90).max(90),
	longitude: z.number().min(-180).max(180),
	timezone: z.string(),
});

export type AddressMatch = z.infer<typeof addressMatchSchema>;

export function formatPostalAddress(address: PostalAddress): string {
	return [
		address.line1,
		address.line2,
		[address.city, address.region, address.postalCode]
			.filter(Boolean)
			.join(", "),
		address.country,
	]
		.filter(Boolean)
		.join(", ");
}
