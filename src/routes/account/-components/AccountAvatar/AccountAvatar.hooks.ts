import type { FileRejectReason, FileUploadItem } from "@code-x/lago";
import { useCallback, useMemo, useState } from "react";
import { authClient } from "../../../../modules/identity/auth-client";
import { readAvatar, storedAvatarItem } from "./AccountAvatar.utils";

export function useAccountAvatar(initialImage: string | null) {
	const [image, setImage] = useState(initialImage);
	const [localItem, setLocalItem] = useState<FileUploadItem | null>(null);
	const [pending, setPending] = useState(false);
	const [message, setMessage] = useState("");
	const [messageKind, setMessageKind] = useState<"error" | "success">(
		"success",
	);
	const storedItem = useMemo(
		() => (image ? storedAvatarItem(image) : null),
		[image],
	);
	const item = localItem ?? storedItem;
	const value = useMemo(() => (item ? [item] : []), [item]);
	const hasImage = item?.status === "complete" || item?.status === "uploading";

	const upload = useCallback(async (picked: FileUploadItem) => {
		setPending(true);
		setMessage("");
		setLocalItem({ ...picked, status: "uploading" });
		try {
			const nextImage = await readAvatar(picked.file);
			const result = await authClient.updateUser({ image: nextImage });
			if (result.error) throw new Error(result.error.message);
			setImage(nextImage);
			setLocalItem(null);
			setMessageKind("success");
			setMessage("Avatar updated.");
		} catch (error) {
			setLocalItem({
				...picked,
				status: "error",
				errorMessage: error instanceof Error ? error.message : "Upload failed.",
			});
			setMessageKind("error");
			setMessage(error instanceof Error ? error.message : "Upload failed.");
		} finally {
			setPending(false);
		}
	}, []);

	const remove = useCallback(async (itemToRemove: FileUploadItem) => {
		if (itemToRemove.id !== "stored-avatar") {
			setLocalItem(null);
			return;
		}
		setPending(true);
		setMessage("");
		try {
			const result = await authClient.updateUser({ image: null });
			if (result.error) throw new Error(result.error.message);
			setImage(null);
			setMessageKind("success");
			setMessage("Avatar removed.");
		} catch (error) {
			setMessageKind("error");
			setMessage(
				error instanceof Error ? error.message : "Could not remove avatar.",
			);
		} finally {
			setPending(false);
		}
	}, []);

	const reject = useCallback((_files: File[], reason: FileRejectReason) => {
		setMessageKind("error");
		setMessage(
			reason === "maxSize"
				? "Image must be under 500 KB."
				: "Choose a PNG, JPEG, or WebP image.",
		);
	}, []);
	const onChange = useCallback(
		(items: FileUploadItem[]) => {
			const picked = items.at(-1);
			if (picked) void upload(picked);
		},
		[upload],
	);
	const onRemove = useCallback(
		(item: FileUploadItem) => void remove(item),
		[remove],
	);
	const onRetry = useCallback(
		(item: FileUploadItem) => void upload(item),
		[upload],
	);

	return {
		value,
		hasImage,
		pending,
		message,
		messageKind,
		reject,
		onChange,
		onRemove,
		onRetry,
	};
}
