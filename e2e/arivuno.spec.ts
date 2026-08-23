import type {Page} from '@playwright/test';
import {enableArivuno, expect, test} from './fixtures';
import {
	BLOCKED_PAGE_URL,
	SHORT_URL,
	SHORTS_FEED_URL,
	SURFACE_CASES,
	WATCH_URL,
	YOUTUBE_HOME_URL,
} from './youtube-fixture';

test.beforeEach(async ({extension}) => {
	await enableArivuno(extension);
});

test.describe('Shorts surfaces', () => {
	for (const surface of SURFACE_CASES) {
		test(`hides Shorts on ${surface.name}`, async ({page}) => {
			await page.goto(surface.url);

			for (const testId of surface.hiddenTestIds) {
				const element = page.getByTestId(testId);
				await expect(element).toHaveCount(1);
				await expect(element).toBeHidden();
			}

			await expect(page.getByTestId(surface.visibleTestId)).toBeVisible();
		});
	}
});

test('redirects a directly loaded Short to the local blocked page', async ({
	page,
}) => {
	await page.goto(YOUTUBE_HOME_URL);
	await waitForBlockedPage(page, () => page.goto(SHORT_URL));

	await expect(page).toHaveTitle('Short blocked · Arivuno');
	await expect(
		page.getByRole('heading', {name: 'Short blocked'}),
	).toBeVisible();
	await expect(page.getByRole('button', {name: 'Go back'})).toBeFocused();
	await expect(
		page.getByRole('link', {name: 'Watch once in the regular player'}),
	).toHaveAttribute('href', WATCH_URL);
	expect(new URL(page.url()).hash).toBe('');
});

test('blocks the Shorts feed without offering Watch once', async ({page}) => {
	await page.goto(YOUTUBE_HOME_URL);
	await waitForBlockedPage(page, () => page.goto(SHORTS_FEED_URL));

	await expect(
		page.getByRole('heading', {name: 'Shorts feed blocked'}),
	).toBeVisible();
	await expect(
		page.getByRole('link', {name: 'Watch once in the regular player'}),
	).toBeHidden();
});

test('intercepts an ordinary in-page Short click', async ({page}) => {
	await page.goto(YOUTUBE_HOME_URL);
	await waitForBlockedPage(page, () =>
		page.getByTestId('direct-short-link').click(),
	);

	await expect(
		page.getByRole('heading', {name: 'Short blocked'}),
	).toBeVisible();
});

test('intercepts an absolute YouTube Short link', async ({page}) => {
	await page.goto(YOUTUBE_HOME_URL);
	await waitForBlockedPage(page, () =>
		page.getByTestId('absolute-short-link').click(),
	);

	await expect(
		page.getByRole('heading', {name: 'Short blocked'}),
	).toBeVisible();
});

test('intercepts a committed YouTube SPA transition', async ({page}) => {
	await page.goto(YOUTUBE_HOME_URL);
	await waitForBlockedPage(page, () =>
		page.getByTestId('spa-short-button').click(),
	);

	await expect(
		page.getByRole('heading', {name: 'Short blocked'}),
	).toBeVisible();
});

test('preserves native new-tab behavior and blocks the new document', async ({
	context,
	page,
}) => {
	await page.goto(YOUTUBE_HOME_URL);
	const newPagePromise = context.waitForEvent('page');
	await page.getByTestId('new-tab-short-link').click();
	const newPage = await newPagePromise;

	await expect(newPage).toHaveURL(BLOCKED_PAGE_URL);
	await expect(
		newPage.getByRole('heading', {name: 'Short blocked'}),
	).toBeVisible();
});

test('keeps Back and Forward safe after the target fragment is scrubbed', async ({
	page,
}) => {
	await page.goto(YOUTUBE_HOME_URL);
	await waitForBlockedPage(page, () =>
		page.getByTestId('direct-short-link').click(),
	);

	await page.getByRole('button', {name: 'Go back'}).click();
	await expect(page).toHaveURL(YOUTUBE_HOME_URL);
	await page.goForward();
	await expect(page).toHaveURL(BLOCKED_PAGE_URL);
	await expect(
		page.getByRole('heading', {name: 'Shorts feed blocked'}),
	).toBeVisible();
	await expect(
		page.getByRole('link', {name: 'Watch once in the regular player'}),
	).toBeHidden();
});

test('opens Watch once in the regular player', async ({page}) => {
	await page.goto(YOUTUBE_HOME_URL);
	await waitForBlockedPage(page, () =>
		page.getByTestId('direct-short-link').click(),
	);

	await page
		.getByRole('link', {name: 'Watch once in the regular player'})
		.click();
	await expect(page).toHaveURL(WATCH_URL);
	await expect(page.getByTestId('regular-player')).toBeVisible();
});

test('responds to light and dark color schemes', async ({page}) => {
	await page.goto(YOUTUBE_HOME_URL);
	await waitForBlockedPage(page, () =>
		page.getByTestId('direct-short-link').click(),
	);

	await page.emulateMedia({colorScheme: 'light'});
	await expect(page.locator(':root')).toHaveCSS('color', 'rgb(32, 28, 24)');
	await page.emulateMedia({colorScheme: 'dark'});
	await expect(page.locator(':root')).toHaveCSS('color', 'rgb(247, 239, 229)');
});

async function waitForBlockedPage(
	page: Page,
	action: () => Promise<unknown>,
): Promise<void> {
	const actionPromise = action().catch((error: unknown) => {
		const message = error instanceof Error ? error.message : String(error);

		if (!/ERR_ABORTED|interrupted by another navigation/i.test(message)) {
			throw error;
		}
	});

	await Promise.all([actionPromise, expect(page).toHaveURL(BLOCKED_PAGE_URL)]);
}
