// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResetPasswordPage } from "./ResetPasswordPage";
import css from "./ResetPasswordPage.module.css";

const { resetPassword, location } = vi.hoisted(() => ({
	resetPassword: vi.fn(),
	location: { search: "?token=one-time-token&next=%2Fsaved" },
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
	authClient: { resetPassword },
}));

afterEach(cleanup);
beforeEach(() => {
	vi.clearAllMocks();
	location.search = "?token=one-time-token&next=%2Fsaved";
	resetPassword.mockResolvedValue({ data: { status: true } });
});

describe("ResetPasswordPage", () => {
	it("rejects a missing or expired token and offers a new link", () => {
		location.search = "?error=INVALID_TOKEN&next=%2Fsaved";
		const { container } = render(<ResetPasswordPage />);
		expect(container.querySelector(`.${css.resetPasswordPage}`)).toBeTruthy();
		expect(screen.getByRole("alert").textContent).toContain(
			"invalid or expired",
		);
		expect(screen.queryByRole("button", { name: "Reset password" })).toBeNull();
		expect(
			screen
				.getByRole("link", { name: "Request a new link" })
				.getAttribute("href"),
		).toBe("/forgot-password?next=%2Fsaved");
	});

	it("checks confirmation before submitting and completes the reset", async () => {
		const user = userEvent.setup();
		render(<ResetPasswordPage />);
		await user.type(screen.getByLabelText("New password"), "password123");
		await user.type(
			screen.getByLabelText("Confirm new password"),
			"different123",
		);
		await user.click(screen.getByRole("button", { name: "Reset password" }));
		expect(screen.getByRole("alert").textContent).toBe(
			"Passwords do not match.",
		);
		expect(resetPassword).not.toHaveBeenCalled();
		await user.clear(screen.getByLabelText("Confirm new password"));
		await user.type(
			screen.getByLabelText("Confirm new password"),
			"password123",
		);
		await user.click(screen.getByRole("button", { name: "Reset password" }));
		await screen.findByRole("heading", { name: "Password updated" });
		expect(resetPassword).toHaveBeenCalledWith({
			newPassword: "password123",
			token: "one-time-token",
		});
		expect(
			screen
				.getByRole("link", { name: "Back to sign in" })
				.getAttribute("href"),
		).toBe("/login?next=%2Fsaved");
	});

	it("offers another link when the token expires during submission", async () => {
		resetPassword.mockResolvedValue({
			error: { code: "INVALID_TOKEN", message: "Invalid token" },
		});
		const user = userEvent.setup();
		render(<ResetPasswordPage />);
		await user.type(screen.getByLabelText("New password"), "password123");
		await user.type(
			screen.getByLabelText("Confirm new password"),
			"password123",
		);
		await user.click(screen.getByRole("button", { name: "Reset password" }));
		await waitFor(() =>
			expect(screen.getByRole("alert").textContent).toContain(
				"invalid or expired",
			),
		);
		expect(
			screen.getByRole("link", { name: "Request a new link" }),
		).toBeTruthy();
	});
});
