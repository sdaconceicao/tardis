// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AccountPage } from "./AccountPage";

const { session } = vi.hoisted(() => ({
	session: {
		data: null as null | {
			user: { id: string; name: string; email: string; image: string | null };
		},
		isPending: false,
		error: null as Error | null,
	},
}));

vi.mock("../../../../modules/identity/auth-client", () => ({
	useSession: () => session,
}));
vi.mock("../AccountAvatar/AccountAvatar", () => ({
	AccountAvatar: () => <div>Avatar editor</div>,
}));
vi.mock("../AccountProfile/AccountProfile", () => ({
	AccountProfile: () => <div>Profile editor</div>,
}));
vi.mock("../../../../components/AppLink/AppLink", () => ({
	AppLink: ({ to, children }: { to: string; children: React.ReactNode }) => (
		<a href={to}>{children}</a>
	),
}));

beforeEach(() => {
	session.data = null;
	session.isPending = false;
	session.error = null;
});
afterEach(cleanup);

it("shows account editors for a signed-in user", () => {
	session.data = {
		user: { id: "1", name: "Ada", email: "ada@example.com", image: null },
	};
	render(<AccountPage />);
	expect(screen.getByRole("heading", { name: "Account" })).toBeTruthy();
	expect(screen.getByText("Avatar editor")).toBeTruthy();
	expect(screen.getByText("Profile editor")).toBeTruthy();
});

it("prompts guests to sign in", () => {
	render(<AccountPage />);
	expect(
		screen.getByRole("link", { name: "Sign in" }).getAttribute("href"),
	).toBe("/login");
});

it("shows a loading state before the session resolves", () => {
	session.isPending = true;
	render(<AccountPage />);
	expect(screen.getByRole("status", { name: "Loading account" })).toBeTruthy();
});
