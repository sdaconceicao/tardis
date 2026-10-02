import { IconButton, useTheme } from "@code-x/lago";
import { Moon, Sun } from "lucide-react";
import css from "./AppearanceButton.module.css";

export function AppearanceButton() {
	const { setTheme } = useTheme();
	return (
		<IconButton
			className={css.appearanceButton}
			variant="quiet"
			aria-label="Toggle light and dark mode"
			onPress={() =>
				setTheme(
					document.documentElement.classList.contains("dark-mode")
						? "light"
						: "dark",
				)
			}
		>
			<Sun className={css.themeSun} aria-hidden="true" />
			<Moon className={css.themeMoon} aria-hidden="true" />
		</IconButton>
	);
}
