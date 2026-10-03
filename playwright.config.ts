import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.TEST_APP_PORT ?? 3006);

export default defineConfig({
	testDir: "./test/e2e",
	fullyParallel: true,
	workers: process.env.CI ? 1 : 3,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 0,
	reporter: "list",
	use: {
		baseURL: `http://localhost:${port}`,
		trace: "on-first-retry",
	},
	projects: [
		{ name: "api", testMatch: "**/api/*.spec.ts" },
		{
			name: "chromium",
			testIgnore: "**/api/*.spec.ts",
			use: { ...devices["Desktop Chrome"] },
		},
		{
			name: "firefox",
			testIgnore: "**/api/*.spec.ts",
			use: { ...devices["Desktop Firefox"] },
		},
		{
			name: "webkit",
			testIgnore: "**/api/*.spec.ts",
			use: { ...devices["Desktop Safari"] },
		},
	],
	webServer: {
		command:
			port === 3006
				? "pnpm dev"
				: `pnpm exec vite dev --port ${port} --strictPort`,
		url: `http://localhost:${port}/login`,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
