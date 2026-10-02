import { describe, expect, it } from "vitest";
import { safeAuthDestination, verificationCallbackURL } from "./auth-redirect";

describe("safeAuthDestination", () => {
	it("keeps local paths and their query strings", () => {
		expect(safeAuthDestination("?next=%2Fsaved%3Fview%3Dlist")).toBe(
			"/saved?view=list",
		);
	});

	it.each([
		"",
		"?next=https%3A%2F%2Fevil.example",
		"?next=%2F%2Fevil.example",
		"?next=%2F%5Cevil.example",
	])("uses the default for an unsafe destination: %s", (search) => {
		expect(safeAuthDestination(search)).toBe("/my-events");
	});
});

describe("verificationCallbackURL", () => {
	it("preserves the requested destination in the verification link", () => {
		expect(verificationCallbackURL("/saved?view=list")).toBe(
			"/login?verified=1&next=%2Fsaved%3Fview%3Dlist",
		);
	});
});
