import {
	Alert,
	type FileRejectReason,
	FileUploader,
	type FileUploadItem,
} from "@code-x/lago";
import { useMemo, useState } from "react";
import { authClient } from "../../../../modules/identity/auth-client";
import css from "./AccountAvatar.module.css";
import {
	AVATAR_ACCEPT,
	AVATAR_MAX_BYTES,
	readAvatar,
	storedAvatarItem,
} from "./AccountAvatar.utils";

type AccountAvatarProps = {
	user: { name: string; email: string; image?: string | null };
};

export function AccountAvatar({ user }: AccountAvatarProps) {
	const [image, setImage] = useState(user.image ?? null);
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
	const hasImage = item?.status === "complete" || item?.status === "uploading";

	async function upload(picked: FileUploadItem) {
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
	}

	async function remove(itemToRemove: FileUploadItem) {
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
	}

	function reject(_files: File[], reason: FileRejectReason) {
		setMessageKind("error");
		setMessage(
			reason === "maxSize"
				? "Image must be under 500 KB."
				: "Choose a PNG, JPEG, or WebP image.",
		);
	}

	return (
		<section className={css.avatarSection} aria-label="Profile picture">
			<FileUploader
				variant="round"
				label="Profile picture"
				hint={hasImage ? undefined : "PNG, JPEG, or WebP · up to 500 KB"}
				accept={AVATAR_ACCEPT}
				maxSize={AVATAR_MAX_BYTES}
				allowsMultiple={false}
				value={item ? [item] : []}
				onChange={(items) => {
					const picked = items.at(-1);
					if (picked) void upload(picked);
				}}
				onReject={reject}
				onRemove={(removed) => void remove(removed)}
				onRetry={(retryItem) => void upload(retryItem)}
				isDisabled={pending}
				className={css.uploader}
			/>
			{message && (
				<Alert
					variant={messageKind}
					role={messageKind === "error" ? "alert" : "status"}
				>
					<Alert.Body>{message}</Alert.Body>
				</Alert>
			)}
		</section>
	);
}
