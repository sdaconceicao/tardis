import { Alert, FileUploader } from "@code-x/lago";
import { useAccountAvatar } from "./AccountAvatar.hooks";
import css from "./AccountAvatar.module.css";
import { AVATAR_ACCEPT, AVATAR_MAX_BYTES } from "./AccountAvatar.utils";

type AccountAvatarProps = {
	user: { name: string; email: string; image?: string | null };
};

export function AccountAvatar({ user }: AccountAvatarProps) {
	const avatar = useAccountAvatar(user.image ?? null);

	return (
		<section className={css.avatarSection} aria-label="Profile picture">
			<FileUploader
				variant="round"
				label="Profile picture"
				hint={avatar.hasImage ? undefined : "PNG, JPEG, or WebP · up to 500 KB"}
				accept={AVATAR_ACCEPT}
				maxSize={AVATAR_MAX_BYTES}
				allowsMultiple={false}
				value={avatar.value}
				onChange={avatar.onChange}
				onReject={avatar.reject}
				onRemove={avatar.onRemove}
				onRetry={avatar.onRetry}
				isDisabled={avatar.pending}
				className={css.uploader}
			/>
			{avatar.message && (
				<Alert
					variant={avatar.messageKind}
					role={avatar.messageKind === "error" ? "alert" : "status"}
				>
					<Alert.Body>{avatar.message}</Alert.Body>
				</Alert>
			)}
		</section>
	);
}
