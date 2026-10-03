// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppHeader } from "./AppHeader";
import css from "./AppHeader.module.css";

const { sessionState } = vi.hoisted(() => ({
	sessionState: {
		current: null as null | {
			user: { name: string; email: string; image: string | null };
		},
	},
}));

vi.mock("@tanstack/react-router", () => ({
	useLocation: () => ({ pathname: "/calendar", searchStr: "?view=week" }),
}));
vi.mock("../../modules/identity/auth-client", () => ({
	useSession: () => ({ data: sessionState.current }),
}));
vi.mock("../AppLink/AppLink", () => ({
	AppLink: ({
		to,
		search,
		activeOptions: _activeOptions,
		children,
		...props
	}: {
		to: string;
		search?: Record<string, string>;
		activeOptions?: unknown;
		children: React.ReactNode;
	}) => (
		<a
			href={`${to}${search ? `?${new URLSearchParams(search)}` : ""}`}
			{...props}
		>
			{children}
		</a>
	),
}));
vi.mock("../AppearanceButton/AppearanceButton", () => ({
	AppearanceButton: () => <button type="button">Appearance</button>,
}));

beforeEach(() => {
	sessionState.current = null;
});
afterEach(cleanup);

describe("AppHeader account control", () => {
	it("keeps the sign-in link for guests", () => {
		render(<AppHeader />);
		expect(
			screen.getByRole("link", { name: "Sign in" }).getAttribute("href"),
		).toBe("/login?next=%2Fcalendar%3Fview%3Dweek");
		expect(screen.queryByRole("img", { name: "Ada Lovelace" })).toBeNull();
	});

	it("shows the user's image with Lago Avatar", () => {
		sessionState.current = {
			user: {
				name: "Ada Lovelace",
				email: "ada@example.com",
				image: "https://example.com/ada.png",
			},
		};
		render(<AppHeader />);
		const link = screen.getByRole("link", { name: "Account: Ada Lovelace" });
		expect(link.getAttribute("href")).toBe("/my-events");
		expect(link.classList.contains(css.accountLink)).toBe(true);
		const image = screen.getByRole("img", { name: "Ada Lovelace" });
		expect(image.tagName).toBe("IMG");
		expect(image.getAttribute("src")).toBe("https://example.com/ada.png");
		fireEvent.error(image);
		expect(screen.getByRole("img", { name: "Ada Lovelace" }).tagName).toBe(
			"SPAN",
		);
		expect(screen.getByText("AL")).toBeTruthy();
	});

	it("shows initials when the account has no image", () => {
		sessionState.current = {
			user: { name: "Ada Lovelace", email: "ada@example.com", image: null },
		};
		render(<AppHeader />);
		expect(screen.getByRole("img", { name: "Ada Lovelace" }).tagName).toBe(
			"SPAN",
		);
		expect(screen.getByText("AL")).toBeTruthy();
	});

	it("uses the email for initials when the profile name is blank", () => {
		sessionState.current = {
			user: { name: " ", email: "ada.lovelace@example.com", image: null },
		};
		render(<AppHeader />);
		expect(
			screen.getByRole("link", { name: "Account: ada.lovelace@example.com" }),
		).toBeTruthy();
		expect(screen.getByText("AL")).toBeTruthy();
	});
});
