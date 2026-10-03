// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AuthLayout } from "./AuthLayout";
import css from "./AuthLayout.module.css";

afterEach(cleanup);

describe("AuthLayout", () => {
	it("renders the shared introduction and a labelled card", () => {
		const { container } = render(
			<AuthLayout>
				<h2 id="auth-heading">Sign in</h2>
			</AuthLayout>,
		);
		expect(
			container.firstElementChild?.classList.contains(css.authLayout),
		).toBe(true);
		expect(
			screen.getByRole("heading", { name: "Find your place in the day." }),
		).toBeTruthy();
		expect(screen.getByRole("region", { name: "Sign in" })).toBeTruthy();
	});
});
