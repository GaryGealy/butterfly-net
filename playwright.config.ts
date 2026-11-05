import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? 'github' : 'list',
	use: { baseURL: 'http://localhost:5174', trace: 'on-first-retry' },
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: 'rm -f e2e.db && npx drizzle-kit migrate && npx vite dev --port 5174 --strictPort',
		port: 5174,
		reuseExistingServer: false,
		env: {
			DATABASE_URL: 'e2e.db',
			FAKE_CLAUDE: '1',
			// Each admin test uses its own account, so parallel tests don't collide.
			ADMIN_EMAILS: 'admin-1@e2e.test,admin-2@e2e.test,admin-3@e2e.test,admin-4@e2e.test',
			// Emails here sign up without an invite, like teamsparq.com in production.
			SIGNUP_DOMAINS: 'company.test'
		},
		timeout: 120_000
	}
});
