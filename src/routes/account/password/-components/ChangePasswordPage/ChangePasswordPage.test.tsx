// @vitest-environment jsdom
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ChangePasswordPage } from "./ChangePasswordPage";

const { session, changePassword } = vi.hoisted(() => ({
	session: {
		data: { user: { name: "Ada", email: "ada@example.com" } } as null | {
			user: { name: string; email: string };
		},
		isPending: false,
		error: null as Error | null,
	},
	changePassword: vi.fn(),
}));
vi.mock("../../../../../modules/identity/auth-client", () => ({
	authClient: { changePassword },
	useSession: () => session,
}));
vi.mock("../../../../../components/AppLink/AppLink", () => ({
	AppLink: ({ to, children }: { to: string; children: React.ReactNode }) => (
		<a href={to}>{children}</a>
	),
}));

beforeEach(() => {
	vi.clearAllMocks();
	session.data = { user: { name: "Ada", email: "ada@example.com" } };
	changePassword.mockResolvedValue({ data: { token: null }, error: null });
});
afterEach(cleanup);

it("changes the password and clears the fields", async () => {
	render(<ChangePasswordPage />);
	fireEvent.change(screen.getByLabelText("Current password"), {
		target: { value: "old-password" },
	});
	fireEvent.change(screen.getByLabelText("New password"), {
		target: { value: "new-password" },
	});
	fireEvent.change(screen.getByLabelText("Confirm new password"), {
		target: { value: "new-password" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Change password" }));
	await waitFor(() =>
		expect(changePassword).toHaveBeenCalledWith({
			currentPassword: "old-password",
			newPassword: "new-password",
			revokeOtherSessions: true,
		}),
	);
	expect(await screen.findByRole("status")).toHaveProperty(
		"textContent",
		"Password updated. Use it next time you sign in.",
	);
	expect(
		(screen.getByLabelText("New password") as HTMLInputElement).value,
	).toBe("");
});

it("rejects mismatched passwords before calling auth", async () => {
	render(<ChangePasswordPage />);
	fireEvent.change(screen.getByLabelText("Current password"), {
		target: { value: "old-password" },
	});
	fireEvent.change(screen.getByLabelText("New password"), {
		target: { value: "new-password" },
	});
	fireEvent.change(screen.getByLabelText("Confirm new password"), {
		target: { value: "different-password" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Change password" }));
	expect(await screen.findByRole("alert")).toHaveProperty(
		"textContent",
		"Passwords do not match.",
	);
	expect(changePassword).not.toHaveBeenCalled();
});

it("shows an auth error and keeps the entered passwords for correction", async () => {
	changePassword.mockResolvedValue({
		error: { message: "Current password is incorrect" },
	});
	render(<ChangePasswordPage />);
	fireEvent.change(screen.getByLabelText("Current password"), {
		target: { value: "wrong-password" },
	});
	fireEvent.change(screen.getByLabelText("New password"), {
		target: { value: "new-password" },
	});
	fireEvent.change(screen.getByLabelText("Confirm new password"), {
		target: { value: "new-password" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Change password" }));
	expect(await screen.findByRole("alert")).toHaveProperty(
		"textContent",
		"Current password is incorrect",
	);
	expect(
		(screen.getByLabelText("New password") as HTMLInputElement).value,
	).toBe("new-password");
});

it("prompts guests to sign in", () => {
	session.data = null;
	render(<ChangePasswordPage />);
	expect(screen.getByRole("link", { name: "Sign in" })).toBeTruthy();
});
