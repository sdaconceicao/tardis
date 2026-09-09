import type {
	DirectionsRequest,
	DirectionsResult,
	MatrixRequest,
	MatrixResult,
} from "./contracts";

/**
 * Adapter contract for OpenRouteService today or another routing backend later.
 * Provider-specific request and response shapes must not escape this boundary.
 */
export interface RoutingProvider {
	getMatrix(request: MatrixRequest): Promise<MatrixResult>;
	getDirections(request: DirectionsRequest): Promise<DirectionsResult>;
}
