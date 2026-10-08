// @vitest-environment jsdom
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccountAvatar } from "./AccountAvatar";

const { updateUser } = vi.hoisted(() => ({ updateUser: vi.fn() }));
vi.mock("../../../../modules/identity/auth-client", () => ({
	authClient: { updateUser },
}));

beforeEach(() => {
	vi.clearAllMocks();
	updateUser.mockResolvedValue({ data: { status: true }, error: null });
	Object.defineProperty(URL, "createObjectURL", {
		configurable: true,
		value: vi.fn(() => "blob:avatar"),
	});
	Object.defineProperty(URL, "revokeObjectURL", {
		configurable: true,
		value: vi.fn(),
	});
});
afterEach(cleanup);

it("uploads an image with Lago FileUploader and updates the avatar", async () => {
	const { container } = render(
		<AccountAvatar
			user={{ name: "Ada Lovelace", email: "ada@example.com", image: null }}
		/>,
	);
	const input = container.querySelector('input[type="file"]');
	expect(input).toBeTruthy();
	const file = new File(
		[Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])],
		"avatar.png",
		{ type: "image/png" },
	);
	fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });
	await waitFor(() =>
		expect(updateUser).toHaveBeenCalledWith({
			image: expect.stringMatching(/^data:image\/png;base64,/),
		}),
	);
	expect(await screen.findByRole("status")).toHaveProperty(
		"textContent",
		"Avatar updated.",
	);
});

it("rejects files that exceed the uploader limit", async () => {
	const { container } = render(
		<AccountAvatar
			user={{ name: "Ada", email: "ada@example.com", image: null }}
		/>,
	);
	const file = new File([new Uint8Array(512_001)], "large.png", {
		type: "image/png",
	});
	fireEvent.change(
		container.querySelector('input[type="file"]') as HTMLInputElement,
		{ target: { files: [file] } },
	);
	expect(await screen.findByRole("alert")).toHaveProperty(
		"textContent",
		"Image must be under 500 KB.",
	);
	expect(updateUser).not.toHaveBeenCalled();
});

it("keeps a failed upload available for retry", async () => {
	updateUser.mockResolvedValue({ error: { message: "Upload failed" } });
	const { container } = render(
		<AccountAvatar
			user={{ name: "Ada", email: "ada@example.com", image: null }}
		/>,
	);
	const file = new File(
		[Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])],
		"avatar.png",
		{ type: "image/png" },
	);
	fireEvent.change(
		container.querySelector('input[type="file"]') as HTMLInputElement,
		{
			target: { files: [file] },
		},
	);
	expect(await screen.findByRole("alert")).toHaveProperty(
		"textContent",
		"Upload failed",
	);
	expect(screen.getByRole("link", { name: "Try again" })).toBeTruthy();
});

it("shows the saved image in the uploader and removes it with its close button", async () => {
	const image =
		"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=";
	const { container } = render(
		<AccountAvatar user={{ name: "Ada", email: "ada@example.com", image }} />,
	);
	expect(container.querySelectorAll(`img[src="${image}"]`)).toHaveLength(1);
	expect(screen.queryByText("Current avatar")).toBeNull();
	fireEvent.click(screen.getByRole("button", { name: "Remove avatar.jpg" }));
	await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ image: null }));
	expect(await screen.findByRole("status")).toHaveProperty(
		"textContent",
		"Avatar removed.",
	);
	expect(container.querySelectorAll(`img[src="${image}"]`)).toHaveLength(0);
});
