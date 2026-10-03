// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CalendarPlaceholder } from "./CalendarPlaceholder";
import css from "./CalendarPlaceholder.module.css";

afterEach(cleanup);

describe("CalendarPlaceholder", () => {
	it.each(["month", "week", "agenda"] as const)(
		"shows the %s empty state with the matching layout",
		(view) => {
			const { container } = render(<CalendarPlaceholder view={view} />);
			const calendar = container.firstElementChild;
			expect(calendar?.classList.contains(css.calendarPlaceholder)).toBe(true);
			expect(calendar?.classList.contains(css.calendarMonth)).toBe(
				view === "month",
			);
			expect(calendar?.classList.contains(css.calendarAgenda)).toBe(
				view === "agenda",
			);
			expect(screen.queryByText("Mon")).toBe(
				view === "agenda" ? null : screen.getByText("Mon"),
			);
			expect(screen.getByText(/will appear here/)).toBeTruthy();
		},
	);
});
