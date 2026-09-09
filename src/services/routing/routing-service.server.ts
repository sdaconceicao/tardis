import {
	directionsRequestSchema,
	matrixRequestSchema,
	type RoutingService,
} from "./contracts";
import type { RoutingProvider } from "./routing-provider";

export function createRoutingService(
	provider: RoutingProvider,
): RoutingService {
	return {
		async getMatrix(request) {
			return provider.getMatrix(matrixRequestSchema.parse(request));
		},
		async getDirections(request) {
			return provider.getDirections(directionsRequestSchema.parse(request));
		},
	};
}
