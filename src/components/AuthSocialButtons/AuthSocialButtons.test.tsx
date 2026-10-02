// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthSocialButtons } from "./AuthSocialButtons";
import css from "./AuthSocialButtons.module.css";

afterEach(cleanup);

describe("AuthSocialButtons", () => {
	it("passes the selected provider to the caller", async () => {
		const onSignIn = vi.fn();
		const { container } = render(
			<AuthSocialButtons pending={false} onSignIn={onSignIn} />,
		);
		expect(
			container.firstElementChild?.classList.contains(css.authSocialButtons),
		).toBe(true);
		const user = userEvent.setup();
		await user.click(screen.getByRole("button", { name: "Google" }));
		await user.click(screen.getByRole("button", { name: "Facebook" }));
		expect(onSignIn).toHaveBeenNthCalledWith(1, "google");
		expect(onSignIn).toHaveBeenNthCalledWith(2, "facebook");
	});

	it("disables providers while an auth request is pending", () => {
		render(<AuthSocialButtons pending onSignIn={vi.fn()} />);
		expect(
			screen.getByRole("button", { name: "Google" }).hasAttribute("disabled"),
		).toBe(true);
		expect(
			screen.getByRole("button", { name: "Facebook" }).hasAttribute("disabled"),
		).toBe(true);
	});
});
