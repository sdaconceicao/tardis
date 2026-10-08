import { IconButton, useTheme } from "@code-x/lago";
import { Moon, Sun } from "lucide-react";
import { useCallback } from "react";
import css from "./AppearanceButton.module.css";

export function AppearanceButton() {
	const { setTheme } = useTheme();
	const toggleTheme = useCallback(
		() =>
			setTheme(
				document.documentElement.classList.contains("dark-mode")
					? "light"
					: "dark",
			),
		[setTheme],
	);
	return (
		<IconButton
			className={css.appearanceButton}
			variant="quiet"
			aria-label="Toggle light and dark mode"
			onPress={toggleTheme}
		>
			<Sun className={css.themeSun} aria-hidden="true" />
			<Moon className={css.themeMoon} aria-hidden="true" />
		</IconButton>
	);
}
