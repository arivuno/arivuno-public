import {defineConfig} from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	fullyParallel: false,
	workers: 1,
	timeout: 20_000,
	expect: {
		timeout: 5_000,
	},
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['github'], ['line']] : 'line',
	outputDir: '.output/playwright',
	use: {
		actionTimeout: 5_000,
		navigationTimeout: 10_000,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
	},
});
