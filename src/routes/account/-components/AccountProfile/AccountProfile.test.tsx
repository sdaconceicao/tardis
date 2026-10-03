// @vitest-environment jsdom
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccountProfile } from "./AccountProfile";

const { updateUser } = vi.hoisted(() => ({ updateUser: vi.fn() }));
vi.mock("../../../../modules/identity/auth-client", () => ({
	authClient: { updateUser },
}));
vi.mock("../../../../components/AppLink/AppLink", () => ({
	AppLink: ({ to, children }: { to: string; children: React.ReactNode }) => (
		<a href={to}>{children}</a>
	),
}));

beforeEach(() => {
	vi.clearAllMocks();
	updateUser.mockResolvedValue({ data: { status: true }, error: null });
});
afterEach(cleanup);

it("saves a changed name and links to password settings", async () => {
	render(
		<AccountProfile
			user={{ name: "Ada Lovelace", email: "ada@example.com" }}
		/>,
	);
	expect(screen.getByText("ada@example.com")).toBeTruthy();
	expect(
		screen.getByRole("link", { name: "Change password" }).getAttribute("href"),
	).toBe("/account/password");
	const saveButton = screen.getByRole("button", { name: "Save" });
	expect(
		screen
			.getByRole("link", { name: "Change password" })
			.compareDocumentPosition(saveButton) & Node.DOCUMENT_POSITION_FOLLOWING,
	).toBeTruthy();
	fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
		target: { value: "Ada Byron" },
	});
	fireEvent.click(saveButton);
	await waitFor(() =>
		expect(updateUser).toHaveBeenCalledWith({ name: "Ada Byron" }),
	);
	const status = await screen.findByRole("status");
	expect(status).toHaveProperty("textContent", "Profile updated.");
	expect(status.previousElementSibling?.textContent).toBe("Profile details");
});

it("shows an update error", async () => {
	updateUser.mockResolvedValue({ error: { message: "Could not save" } });
	render(<AccountProfile user={{ name: "Ada", email: "ada@example.com" }} />);
	fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
		target: { value: "Grace" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Save" }));
	expect(await screen.findByRole("alert")).toHaveProperty(
		"textContent",
		"Could not save",
	);
});
