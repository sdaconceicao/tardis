// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ForgotPasswordPage } from "./ForgotPasswordPage";
import css from "./ForgotPasswordPage.module.css";

const { requestPasswordReset } = vi.hoisted(() => ({
	requestPasswordReset: vi.fn(),
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
	authClient: { requestPasswordReset },
}));

afterEach(cleanup);
beforeEach(() => {
	vi.clearAllMocks();
	requestPasswordReset.mockResolvedValue({ data: { status: true } });
});

describe("ForgotPasswordPage", () => {
	it("requests a reset link without disclosing whether the account exists", async () => {
		const user = userEvent.setup();
		const { container } = render(<ForgotPasswordPage />);
		expect(container.querySelector(`.${css.forgotPasswordPage}`)).toBeTruthy();
		await user.type(
			screen.getByRole("textbox", { name: "Email" }),
			"ada@example.com",
		);
		await user.click(screen.getByRole("button", { name: "Send reset link" }));
		await screen.findByRole("status");
		expect(screen.getByRole("status").textContent).toContain(
			"If an account uses this email",
		);
		expect(requestPasswordReset).toHaveBeenCalledWith({
			email: "ada@example.com",
			redirectTo: "/reset-password?next=%2Fsaved",
		});
		expect(
			screen
				.getByRole("link", { name: "Back to sign in" })
				.getAttribute("href"),
		).toBe("/login?next=%2Fsaved");
	});

	it("shows a delivery error and allows retrying", async () => {
		requestPasswordReset.mockResolvedValue({
			error: { message: "Email service unavailable" },
		});
		const user = userEvent.setup();
		render(<ForgotPasswordPage />);
		await user.type(
			screen.getByRole("textbox", { name: "Email" }),
			"ada@example.com",
		);
		await user.click(screen.getByRole("button", { name: "Send reset link" }));
		await waitFor(() =>
			expect(screen.getByRole("alert").textContent).toContain(
				"Email service unavailable",
			),
		);
		requestPasswordReset.mockResolvedValue({ data: { status: true } });
		await user.click(screen.getByRole("button", { name: "Send reset link" }));
		await screen.findByRole("status");
	});
});
