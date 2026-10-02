// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage";

const { signUp, signIn, social, resend, location } = vi.hoisted(() => ({
	signUp: vi.fn(),
	signIn: vi.fn(),
	social: vi.fn(),
	resend: vi.fn(),
	location: { search: "?next=%2Fsaved" },
}));

vi.mock("@tanstack/react-router", () => ({
	useLocation: ({
		select,
	}: {
		select: (location: { searchStr: string }) => string;
	}) => select({ searchStr: location.search }),
}));
vi.mock("../../../../components/AppLink/AppLink", () => ({
	AppLink: ({
		to,
		search,
		children,
		...props
	}: {
		to: string;
		search?: { next: string };
		children: React.ReactNode;
	}) => (
		<a
			href={`${to}${search ? `?next=${encodeURIComponent(search.next)}` : ""}`}
			{...props}
		>
			{children}
		</a>
	),
}));
vi.mock("../../../../modules/identity/auth-client", () => ({
	authClient: {
		signUp: { email: signUp },
		signIn: { email: signIn, social },
		sendVerificationEmail: resend,
	},
}));

afterEach(cleanup);
beforeEach(() => {
	vi.clearAllMocks();
	location.search = "?next=%2Fsaved";
	signUp.mockResolvedValue({ data: {} });
	signIn.mockResolvedValue({
		error: {
			code: "INVALID_EMAIL_OR_PASSWORD",
			message: "Invalid credentials",
		},
	});
	resend.mockResolvedValue({ data: {} });
	social.mockResolvedValue({ error: { message: "Social login unavailable" } });
});

describe("LoginPage", () => {
	it("shows verification and provider errors with a sign-up link", () => {
		location.search = "?verified=1&error=access_denied&next=%2Fsaved";
		const { container } = render(<LoginPage />);
		expect(
			container.querySelector("section[aria-labelledby='auth-heading']"),
		).toBeTruthy();
		expect(screen.getByRole("textbox", { name: /email/i })).toBeTruthy();
		expect(screen.getByRole("status").textContent).toContain("Email verified");
		expect(screen.getByRole("alert").textContent).toContain(
			"Social sign in did not complete",
		);
		expect(
			screen.getByRole("link", { name: "Sign up" }).getAttribute("href"),
		).toBe("/signup?next=%2Fsaved");
	});

	it("offers resend after an unverified login", async () => {
		const user = userEvent.setup();
		signIn.mockResolvedValue({
			error: { code: "EMAIL_NOT_VERIFIED", message: "Unverified" },
		});
		render(<LoginPage />);
		await user.type(
			screen.getByRole("textbox", { name: /email/i }),
			"ada@example.com",
		);
		await user.type(screen.getByLabelText("Password"), "password123");
		await user.click(screen.getByRole("button", { name: /^Sign in$/ }));
		await screen.findByRole("button", { name: "Resend verification email" });
		expect(screen.getByRole("alert").textContent).toMatch(/Verify your email/);
		await user.click(
			screen.getByRole("button", { name: "Resend verification email" }),
		);
		await screen.findByText("A new verification link is on its way.");
		expect(resend).toHaveBeenCalledWith({
			email: "ada@example.com",
			callbackURL: "/login?verified=1&next=%2Fsaved",
		});
	});

	it("shows login errors and allows revealing the password", async () => {
		const user = userEvent.setup();
		render(<LoginPage />);
		await user.type(
			screen.getByRole("textbox", { name: /email/i }),
			"ada@example.com",
		);
		const password = screen.getByLabelText("Password");
		await user.type(password, "password123");
		await user.click(screen.getByRole("button", { name: "Show password" }));
		expect(password.getAttribute("type")).toBe("text");
		await user.click(screen.getByRole("button", { name: /^Sign in$/ }));
		await waitFor(() =>
			expect(screen.getByRole("alert").textContent).toBe("Invalid credentials"),
		);
	});

	it.each([
		"Google",
		"Facebook",
	])("starts %s login with the requested destination", async (provider) => {
		const user = userEvent.setup();
		render(<LoginPage />);
		await user.click(screen.getByRole("button", { name: provider }));
		await waitFor(() =>
			expect(social).toHaveBeenCalledWith({
				provider: provider.toLowerCase(),
				callbackURL: "/saved",
				errorCallbackURL: "/login",
			}),
		);
		await screen.findByRole("alert");
	});
});
