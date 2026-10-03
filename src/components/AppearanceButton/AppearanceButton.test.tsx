// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppearanceButton } from "./AppearanceButton";

const { setTheme } = vi.hoisted(() => ({ setTheme: vi.fn() }));
vi.mock("@code-x/lago", () => ({
	useTheme: () => ({ setTheme }),
	IconButton: ({
		onPress,
		children,
		...props
	}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
		onPress: () => void;
	}) => (
		<button type="button" onClick={onPress} {...props}>
			{children}
		</button>
	),
}));

afterEach(() => {
	cleanup();
	setTheme.mockClear();
	document.documentElement.classList.remove("dark-mode");
});

describe("AppearanceButton", () => {
	it("switches from light to dark mode", () => {
		render(<AppearanceButton />);
		fireEvent.click(
			screen.getByRole("button", { name: "Toggle light and dark mode" }),
		);
		expect(setTheme).toHaveBeenCalledWith("dark");
	});

	it("switches from dark to light mode", () => {
		document.documentElement.classList.add("dark-mode");
		render(<AppearanceButton />);
		fireEvent.click(
			screen.getByRole("button", { name: "Toggle light and dark mode" }),
		);
		expect(setTheme).toHaveBeenCalledWith("light");
	});
});
