// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignupPage } from "./SignupPage";

const { signUp, signIn, social, resend } = vi.hoisted(() => ({
	signUp: vi.fn(),
	signIn: vi.fn(),
	social: vi.fn(),
	resend: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
	useLocation: ({
		select,
	}: {
		select: (location: { searchStr: string }) => string;
	}) => select({ searchStr: "?next=%2Fsaved" }),
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

describe("SignupPage", () => {
	it("renders the registration form and sign-in link", () => {
		render(<SignupPage />);
		expect(
			screen.getByRole("heading", { name: "Create account" }),
		).toBeTruthy();
		expect(
			screen.getByRole("link", { name: "Sign in" }).getAttribute("href"),
		).toBe("/login?next=%2Fsaved");
	});

	it("shows a mismatch before submitting registration", async () => {
		const user = userEvent.setup();
		render(<SignupPage />);
		await user.type(screen.getByRole("textbox", { name: /name/i }), "Ada");
		await user.type(
			screen.getByRole("textbox", { name: /email/i }),
			"ada@example.com",
		);
		await user.type(
			screen.getByLabelText("Password", { exact: true }),
			"password123",
		);
		await user.type(screen.getByLabelText("Confirm password"), "different123");
		await user.click(screen.getByRole("button", { name: "Create account" }));
		expect(screen.getByRole("alert").textContent).toBe(
			"Passwords do not match.",
		);
		expect(signUp).not.toHaveBeenCalled();
	});

	it("uses separate Lago password reveal controls", async () => {
		const user = userEvent.setup();
		render(<SignupPage />);
		const password = screen.getByLabelText("Password", { exact: true });
		const confirmation = screen.getByLabelText("Confirm password");
		expect(
			screen.getAllByRole("button", { name: "Show password" }),
		).toHaveLength(2);
		await user.click(
			screen.getAllByRole("button", { name: "Show password" })[0],
		);
		expect(password.getAttribute("type")).toBe("text");
		expect(confirmation.getAttribute("type")).toBe("password");
	});

	it("registers, explains verification, and resends the email", async () => {
		const user = userEvent.setup();
		render(<SignupPage />);
		await user.type(screen.getByRole("textbox", { name: /name/i }), " Ada ");
		await user.type(
			screen.getByRole("textbox", { name: /email/i }),
			"ada@example.com",
		);
		await user.type(
			screen.getByLabelText("Password", { exact: true }),
			"password123",
		);
		await user.type(screen.getByLabelText("Confirm password"), "password123");
		await user.click(screen.getByRole("button", { name: "Create account" }));
		await screen.findByRole("heading", { name: "Check your inbox" });
		expect(signUp).toHaveBeenCalledWith({
			name: "Ada",
			email: "ada@example.com",
			password: "password123",
			callbackURL: "/login?verified=1&next=%2Fsaved",
		});
		await user.click(
			screen.getByRole("button", { name: "Resend verification email" }),
		);
		await screen.findByText("A new verification link is on its way.");
		expect(resend).toHaveBeenCalledWith({
			email: "ada@example.com",
			callbackURL: "/login?verified=1&next=%2Fsaved",
		});
	});
});
