import { describe, expect, it } from "vitest";
import { AVATAR_MAX_BYTES, isAllowedAvatarData } from "./AccountAvatar.utils";

const png =
	"data:image/png;base64," +
	Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]).toString("base64");

describe("avatar validation", () => {
	it("accepts a small PNG with a matching signature", () => {
		expect(isAllowedAvatarData(png, 12)).toBe(true);
	});

	it("rejects oversized files and spoofed formats", () => {
		expect(isAllowedAvatarData(png, AVATAR_MAX_BYTES + 1)).toBe(false);
		expect(
			isAllowedAvatarData(png.replace("image/png", "image/jpeg"), 12),
		).toBe(false);
		expect(isAllowedAvatarData("data:image/svg+xml;base64,PHN2Zz4=", 5)).toBe(
			false,
		);
	});
});
