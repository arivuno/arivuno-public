import {access, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {
	chromium,
	expect,
	test as base,
	type BrowserContext,
	type ConsoleMessage,
	type Page,
} from '@playwright/test';
import {installYouTubeFixture} from './youtube-fixture';

const extensionPath = resolve('.output/chrome-mv3');

export const test = base.extend<{context: BrowserContext}>({
	context: async ({browserName}, use) => {
		expect(browserName).toBe('chromium');
		await access(resolve(extensionPath, 'manifest.json'));
		const profilePath = await mkdtemp(join(tmpdir(), 'arivuno-e2e-'));
		const runtimeErrors: string[] = [];
		const unexpectedNetworkRequests: string[] = [];
		const context = await chromium.launchPersistentContext(profilePath, {
			channel: 'chromium',
			headless: true,
			viewport: {width: 1280, height: 800},
			args: [
				`--disable-extensions-except=${extensionPath}`,
				`--load-extension=${extensionPath}`,
			],
		});
		await installYouTubeFixture(context, (description) => {
			unexpectedNetworkRequests.push(description);
		});

		const recordPageErrors = (page: Page): void => {
			page.on('console', (message: ConsoleMessage) => {
				if (message.type() === 'error') {
					runtimeErrors.push(`console: ${message.text()}`);
				}
			});
			page.on('pageerror', (error) => {
				runtimeErrors.push(`pageerror: ${error.message}`);
			});
		};

		for (const page of context.pages()) {
			recordPageErrors(page);
		}
		context.on('page', recordPageErrors);

		try {
			await use(context);
			expect(
				unexpectedNetworkRequests,
				'unexpected browser network requests',
			).toEqual([]);
			expect(runtimeErrors, 'browser runtime errors').toEqual([]);
		} finally {
			await context.close();
			await rm(profilePath, {recursive: true, force: true});
		}
	},
});

export {expect};
