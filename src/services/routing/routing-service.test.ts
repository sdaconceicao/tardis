import { describe, expect, it, vi } from "vitest";
import { MAX_MATRIX_DESTINATIONS } from "./contracts";
import type { RoutingProvider } from "./routing-provider";
import { createRoutingService } from "./routing-service.server";

const origin = { longitude: -73.9857, latitude: 40.7484 };

function createProvider(): RoutingProvider {
	return {
		getMatrix: vi.fn().mockResolvedValue({
			status: "available",
			routes: [{ distanceMeters: 1_000, durationSeconds: 720 }],
		}),
		getDirections: vi.fn().mockResolvedValue({
			status: "available",
			route: {
				distanceMeters: 1_000,
				durationSeconds: 720,
				geometry: {
					type: "LineString",
					coordinates: [
						[-73.9857, 40.7484],
						[-73.9772, 40.7527],
					],
				},
			},
		}),
	};
}

describe("routing service", () => {
	it("validates and delegates matrix requests", async () => {
		const provider = createProvider();
		const service = createRoutingService(provider);
		const request = {
			origin,
			destinations: [{ longitude: -73.9772, latitude: 40.7527 }],
			profile: "walking" as const,
		};

		await expect(service.getMatrix(request)).resolves.toMatchObject({
			status: "available",
		});
		expect(provider.getMatrix).toHaveBeenCalledWith(request);
	});

	it("rejects matrices beyond the bounded request size", async () => {
		const provider = createProvider();
		const service = createRoutingService(provider);
		const destinations = Array.from(
			{ length: MAX_MATRIX_DESTINATIONS + 1 },
			() => origin,
		);

		await expect(
			service.getMatrix({ origin, destinations, profile: "walking" }),
		).rejects.toThrow();
		expect(provider.getMatrix).not.toHaveBeenCalled();
	});
});
