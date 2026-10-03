// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
	AVATAR_MAX_BYTES,
	isAllowedAvatarData,
	readAvatar,
	storedAvatarItem,
} from "./AccountAvatar.utils";

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

	it("accepts supported image signatures and the maximum size", () => {
		const jpeg = `data:image/jpeg;base64,${Buffer.from([255, 216, 255, 224, 0]).toString("base64")}`;
		const webp = `data:image/webp;base64,${Buffer.from([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]).toString("base64")}`;
		expect(isAllowedAvatarData(jpeg, AVATAR_MAX_BYTES)).toBe(true);
		expect(isAllowedAvatarData(webp, 12)).toBe(true);
		expect(isAllowedAvatarData(png, 0)).toBe(false);
		expect(isAllowedAvatarData("data:image/png;base64,%%%", 10)).toBe(false);
	});

	it("keeps the stored image preview as a completed upload item", () => {
		expect(storedAvatarItem("https://example.test/avatar.png")).toMatchObject({
			id: "stored-avatar",
			previewUrl: "https://example.test/avatar.png",
			status: "complete",
		});
	});

	it("reads a valid image and rejects a spoofed file", async () => {
		const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
		await expect(
			readAvatar(new File([bytes], "avatar.png", { type: "image/png" })),
		).resolves.toBe(png);
		await expect(
			readAvatar(new File([bytes], "avatar.jpg", { type: "image/jpeg" })),
		).rejects.toThrow(/Choose a PNG/);
	});
});
