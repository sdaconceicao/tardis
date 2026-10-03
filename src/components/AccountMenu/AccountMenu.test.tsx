// @vitest-environment jsdom
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountMenu } from "./AccountMenu";

const { navigate, signOut } = vi.hoisted(() => ({
	navigate: vi.fn(),
	signOut: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }));
vi.mock("../../modules/identity/auth-client", () => ({ signOut }));
vi.mock("../AppLink/AppLink", () => ({
	AppLink: ({
		to,
		children,
		onPress,
		...props
	}: {
		to: string;
		children: React.ReactNode;
		onPress?: () => void;
	}) => (
		<a href={to} onClick={onPress} {...props}>
			{children}
		</a>
	),
}));

const user = { name: "Ada Lovelace", email: "ada@example.com", image: null };

beforeEach(() => {
	vi.clearAllMocks();
	navigate.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("AccountMenu", () => {
	it("shows the profile and account link in a Lago sheet", async () => {
		render(<AccountMenu user={user} />);
		fireEvent.click(
			screen.getByRole("button", {
				name: "Open account menu for Ada Lovelace",
			}),
		);
		expect(
			await screen.findByRole("dialog", { name: "Your account" }),
		).toBeTruthy();
		expect(screen.getByText("ada@example.com")).toBeTruthy();
		expect(
			screen.getByRole("link", { name: "Account" }).getAttribute("href"),
		).toBe("/account");
		expect(screen.getByRole("button", { name: "Logout" })).toBeTruthy();
	});

	it("closes when clicked outside the sheet, but not inside it", async () => {
		render(<AccountMenu user={user} />);
		fireEvent.click(
			screen.getByRole("button", {
				name: "Open account menu for Ada Lovelace",
			}),
		);
		await screen.findByRole("dialog", { name: "Your account" });
		fireEvent.pointerDown(
			screen.getByRole("heading", { name: "Your account" }),
		);
		expect(screen.getByRole("dialog", { name: "Your account" })).toBeTruthy();
		fireEvent.pointerDown(document.body);
		await waitFor(() =>
			expect(screen.queryByRole("dialog", { name: "Your account" })).toBeNull(),
		);
	});

	it("logs out and opens the login page", async () => {
		signOut.mockResolvedValue({ data: { success: true }, error: null });
		render(<AccountMenu user={user} />);
		fireEvent.click(
			screen.getByRole("button", {
				name: "Open account menu for Ada Lovelace",
			}),
		);
		fireEvent.click(await screen.findByRole("button", { name: "Logout" }));
		await waitFor(() => expect(signOut).toHaveBeenCalledOnce());
		await waitFor(() =>
			expect(navigate).toHaveBeenCalledWith({ to: "/login" }),
		);
	});

	it("keeps the sheet open when logout fails", async () => {
		signOut.mockResolvedValue({ error: { message: "No connection" } });
		render(<AccountMenu user={user} />);
		fireEvent.click(
			screen.getByRole("button", {
				name: "Open account menu for Ada Lovelace",
			}),
		);
		fireEvent.click(await screen.findByRole("button", { name: "Logout" }));
		expect(await screen.findByRole("alert")).toHaveProperty(
			"textContent",
			"Could not log out. Please try again.",
		);
		expect(navigate).not.toHaveBeenCalled();
	});
});
