import { z } from "zod";

export const MAX_MATRIX_DESTINATIONS = 25;

export const coordinateSchema = z.object({
	longitude: z.number().min(-180).max(180),
	latitude: z.number().min(-90).max(90),
});

export const travelProfileSchema = z.enum([
	"walking",
	"cycling",
	"driving",
	"wheelchair",
]);

export const matrixRequestSchema = z.object({
	origin: coordinateSchema,
	destinations: z.array(coordinateSchema).min(1).max(MAX_MATRIX_DESTINATIONS),
	profile: travelProfileSchema,
});

export const directionsRequestSchema = z.object({
	origin: coordinateSchema,
	destination: coordinateSchema,
	profile: travelProfileSchema,
});

export type Coordinate = z.infer<typeof coordinateSchema>;
export type TravelProfile = z.infer<typeof travelProfileSchema>;
export type MatrixRequest = z.infer<typeof matrixRequestSchema>;
export type DirectionsRequest = z.infer<typeof directionsRequestSchema>;

export interface RouteMetric {
	distanceMeters: number;
	durationSeconds: number;
}

export interface RouteGeometry {
	type: "LineString";
	coordinates: Array<[longitude: number, latitude: number]>;
}

export type RoutingUnavailableReason = "quota" | "timeout" | "provider-error";

export type MatrixResult =
	| {
			status: "available";
			routes: Array<RouteMetric | null>;
	  }
	| {
			status: "unavailable";
			reason: RoutingUnavailableReason;
	  };

export type DirectionsResult =
	| {
			status: "available";
			route: RouteMetric & { geometry: RouteGeometry };
	  }
	| {
			status: "unavailable";
			reason: RoutingUnavailableReason;
	  };

export interface RoutingService {
	getMatrix(request: MatrixRequest): Promise<MatrixResult>;
	getDirections(request: DirectionsRequest): Promise<DirectionsResult>;
}
