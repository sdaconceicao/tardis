import type { FileUploadItem } from "@code-x/lago";

export const AVATAR_ACCEPT = "image/png,image/jpeg,image/webp";
export const AVATAR_MAX_BYTES = 512_000;

export function storedAvatarItem(image: string): FileUploadItem {
	return {
		id: "stored-avatar",
		file: new File([], "avatar.jpg", { type: "image/jpeg" }),
		previewUrl: image,
		status: "complete",
	};
}

export function isAllowedAvatarData(dataUri: string, size: number) {
	if (size < 1 || size > AVATAR_MAX_BYTES) return false;
	const match =
		/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
			dataUri,
		);
	if (!match) return false;
	const bytes = atob(match[2].slice(0, 16));
	const code = (index: number) => bytes.charCodeAt(index);
	if (match[1] === "image/png")
		return [137, 80, 78, 71, 13, 10, 26, 10].every(
			(byte, index) => code(index) === byte,
		);
	if (match[1] === "image/jpeg")
		return code(0) === 255 && code(1) === 216 && code(2) === 255;
	return bytes.slice(0, 4) === "RIFF" && bytes.slice(8, 12) === "WEBP";
}

export async function readAvatar(file: File): Promise<string> {
	const dataUri = await new Promise<string>((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(new Error("Could not read the image."));
		reader.onload = () => resolve(String(reader.result));
		reader.readAsDataURL(file);
	});
	if (!isAllowedAvatarData(dataUri, file.size))
		throw new Error("Choose a PNG, JPEG, or WebP image under 500 KB.");
	return dataUri;
}
