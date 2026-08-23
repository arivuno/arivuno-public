import {
	ACTIVATION_DISCLOSURE_VERSION,
	ACTIVATION_DOCUMENT_ATTRIBUTE,
} from '../src/activation/state';
import {isExpectedYoutubeRegistration} from '../src/activation/registration';
import {ACTIVATION_ENABLE_MESSAGE} from '../src/activation/protocol';
import {enableArivuno, expect, expectEnabledState, test} from './fixtures';
import {SHORT_URL, YOUTUBE_HOME_URL} from './youtube-fixture';

test('fresh install opens disclosure and remains off without agreement', async ({
	context,
	extension,
}) => {
	const optionsPage = await extension.waitForInstalledOptionsPage();

	await expect(
		optionsPage.getByRole('heading', {name: 'Before you enable Arivuno'}),
	).toBeVisible();
	await expect(optionsPage.getByText('the current YouTube URL;')).toBeVisible();
	await expect(
		optionsPage.getByText('destinations of links on YouTube;'),
	).toBeVisible();
	await expect(
		optionsPage.getByText('visible YouTube page structure;'),
	).toBeVisible();
	await expect(
		optionsPage.getByText(/ordinary click or activation events/),
	).toBeVisible();
	await expect(
		optionsPage.getByText(/does not retain or automatically transmit/),
	).toBeVisible();
	await expect(
		optionsPage.getByRole('button', {name: 'Enable Arivuno'}),
	).toBeVisible();
	await expect(
		optionsPage.getByRole('button', {name: 'Not now'}),
	).toBeVisible();
	await optionsPage.setViewportSize({width: 320, height: 800});
	expect(
		await optionsPage.evaluate(
			() => document.documentElement.scrollWidth <= window.innerWidth,
		),
	).toBe(true);

	expect(await extension.getActivationState()).toBeUndefined();
	expect(await extension.getRegistrations()).toEqual([]);

	const youtubePage = await context.newPage();
	await youtubePage.goto(YOUTUBE_HOME_URL);
	await expect(youtubePage.getByTestId('guide-short')).toBeVisible();
	await expect(
		youtubePage.locator(`html[${ACTIVATION_DOCUMENT_ATTRIBUTE}]`),
	).toHaveCount(0);
	await youtubePage.goto(SHORT_URL);
	await expect(youtubePage.getByTestId('unexpected-shorts-page')).toBeVisible();

	const closed = optionsPage.waitForEvent('close');
	const click = optionsPage
		.getByRole('button', {name: 'Not now'})
		.click()
		.catch((error: unknown) => {
			if (!optionsPage.isClosed()) {
				throw error;
			}
		});
	await Promise.all([closed, click]);
	expect(await extension.getActivationState()).toBeUndefined();
	expect(await extension.getRegistrations()).toEqual([]);
});

test('enable applies to new or reloaded YouTube documents', async ({
	context,
	extension,
}) => {
	const youtubePage = await context.newPage();
	await youtubePage.goto(YOUTUBE_HOME_URL);
	await expect(youtubePage.getByTestId('guide-short')).toBeVisible();

	await enableArivuno(extension);
	await expectEnabledState(extension);
	await expect(
		youtubePage.locator(`html[${ACTIVATION_DOCUMENT_ATTRIBUTE}]`),
	).toHaveCount(0);
	await expect(youtubePage.getByTestId('guide-short')).toBeVisible();

	await youtubePage.reload();
	await expect(
		youtubePage.locator(`html[${ACTIVATION_DOCUMENT_ATTRIBUTE}]`),
	).toHaveCount(1);
	await expect(youtubePage.getByTestId('guide-short')).toBeHidden();
});

test('keeps multiple manage pages and repeated enable in sync', async ({
	context,
	extension,
}) => {
	const firstOptionsPage = await extension.waitForInstalledOptionsPage();
	const secondOptionsPage = await context.newPage();
	await secondOptionsPage.goto(extension.optionsUrl);
	await expect(firstOptionsPage.getByRole('status')).toHaveText(
		'Arivuno is off. It does not inspect or change YouTube pages.',
	);
	await expect(secondOptionsPage.getByRole('status')).toHaveText(
		'Arivuno is off. It does not inspect or change YouTube pages.',
	);

	await firstOptionsPage.getByRole('button', {name: 'Enable Arivuno'}).click();
	await expect(firstOptionsPage.getByRole('status')).toHaveText(
		'Arivuno is enabled.',
	);
	await expect(secondOptionsPage.getByRole('status')).toHaveText(
		'Arivuno is enabled.',
	);

	const youtubePage = await context.newPage();
	await youtubePage.goto(YOUTUBE_HOME_URL);
	await expect(
		youtubePage.locator(`html[${ACTIVATION_DOCUMENT_ATTRIBUTE}]`),
	).toHaveCount(1);

	const response = await secondOptionsPage.evaluate(async (type) => {
		const extensionGlobal = globalThis as unknown as {
			chrome: {
				runtime: {
					sendMessage: (message: {type: string}) => Promise<unknown>;
				};
			};
		};

		return extensionGlobal.chrome.runtime.sendMessage({type});
	}, ACTIVATION_ENABLE_MESSAGE);
	expect(response).toEqual({ok: true, enabled: true});
	await expect(
		youtubePage.locator(`html[${ACTIVATION_DOCUMENT_ATTRIBUTE}]`),
	).toHaveCount(1);
	await expect(youtubePage.getByTestId('guide-short')).toBeHidden();
});

test('ignores a stale manage response after a newer activation change', async ({
	context,
	extension,
}) => {
	const firstOptionsPage = await extension.waitForInstalledOptionsPage();
	const secondOptionsPage = await context.newPage();
	await secondOptionsPage.goto(extension.optionsUrl);
	await expect(firstOptionsPage.getByRole('status')).toHaveText(
		'Arivuno is off. It does not inspect or change YouTube pages.',
	);
	await expect(secondOptionsPage.getByRole('status')).toHaveText(
		'Arivuno is off. It does not inspect or change YouTube pages.',
	);

	await firstOptionsPage.evaluate((enableType) => {
		type OptionsGlobal = {
			chrome: {
				runtime: {
					sendMessage: (message: {type: string}) => Promise<unknown>;
				};
			};
			releaseDelayedEnable?: () => void;
		};
		const extensionGlobal = globalThis as unknown as OptionsGlobal;
		const runtime = extensionGlobal.chrome.runtime;
		const sendMessage = runtime.sendMessage.bind(runtime);
		let releaseDelayedEnable = (): void => undefined;
		const delayedEnable = new Promise<void>((resolve) => {
			releaseDelayedEnable = resolve;
		});
		extensionGlobal.releaseDelayedEnable = releaseDelayedEnable;
		runtime.sendMessage = async (message) => {
			const response = await sendMessage(message);

			if (message.type === enableType) {
				await delayedEnable;
			}

			return response;
		};
	}, ACTIVATION_ENABLE_MESSAGE);

	await firstOptionsPage.getByRole('button', {name: 'Enable Arivuno'}).click();
	await expect(secondOptionsPage.getByRole('status')).toHaveText(
		'Arivuno is enabled.',
	);
	await secondOptionsPage
		.getByRole('button', {name: 'Disable Arivuno'})
		.click();
	await expect(firstOptionsPage.getByRole('status')).toHaveText(
		'Arivuno is off. It does not inspect or change YouTube pages.',
	);
	await expect(secondOptionsPage.getByRole('status')).toHaveText(
		'Arivuno is off. It does not inspect or change YouTube pages.',
	);
	expect(await extension.getActivationState()).toBeUndefined();
	expect(await extension.getRegistrations()).toEqual([]);

	await firstOptionsPage.evaluate(async () => {
		const extensionGlobal = globalThis as unknown as {
			releaseDelayedEnable?: () => void;
		};
		extensionGlobal.releaseDelayedEnable?.();
		await new Promise((resolve) => setTimeout(resolve, 50));
	});
	await expect(firstOptionsPage.getByRole('status')).toHaveText(
		'Arivuno is off. It does not inspect or change YouTube pages.',
	);
});

test('disable deactivates an already-open YouTube document', async ({
	context,
	extension,
}) => {
	const optionsPage = await enableArivuno(extension);
	const youtubePage = await context.newPage();
	await youtubePage.goto(YOUTUBE_HOME_URL);
	await expect(youtubePage.getByTestId('guide-short')).toBeHidden();

	await optionsPage.getByRole('button', {name: 'Disable Arivuno'}).click();
	await expect(optionsPage.getByRole('status')).toHaveText(
		'Arivuno is off. It does not inspect or change YouTube pages.',
	);
	await expect(
		youtubePage.locator(`html[${ACTIVATION_DOCUMENT_ATTRIBUTE}]`),
	).toHaveCount(0);
	await expect(youtubePage.getByTestId('guide-short')).toBeVisible();
	await expect.poll(() => extension.getRegistrations()).toEqual([]);
	expect(await extension.getActivationState()).toBeUndefined();

	await youtubePage.getByTestId('direct-short-link').click();
	await expect(youtubePage).toHaveURL(SHORT_URL);
	await expect(youtubePage.getByTestId('unexpected-shorts-page')).toBeVisible();
});

test('old and corrupt activation records fail closed', async ({
	context,
	extension,
}) => {
	const optionsPage = await enableArivuno(extension);
	const youtubePage = await context.newPage();
	await youtubePage.goto(YOUTUBE_HOME_URL);
	await expect(youtubePage.getByTestId('guide-short')).toBeHidden();

	await extension.setActivationState({
		enabled: true,
		disclosureVersion: ACTIVATION_DISCLOSURE_VERSION - 1,
	});
	await expect(
		youtubePage.locator(`html[${ACTIVATION_DOCUMENT_ATTRIBUTE}]`),
	).toHaveCount(0);
	await expect(youtubePage.getByTestId('guide-short')).toBeVisible();

	const nextPage = await context.newPage();
	await nextPage.goto(SHORT_URL);
	await expect(nextPage.getByTestId('unexpected-shorts-page')).toBeVisible();

	await optionsPage.reload();
	await expect(optionsPage.getByRole('status')).toHaveText(
		'Arivuno is off. It does not inspect or change YouTube pages.',
	);
	await expect.poll(() => extension.getRegistrations()).toEqual([]);
	expect(await extension.getActivationState()).toBeUndefined();

	await extension.setActivationState({enabled: 'yes'});
	await optionsPage.reload();
	await expect(optionsPage.getByRole('status')).toHaveText(
		'Arivuno is off. It does not inspect or change YouTube pages.',
	);
	expect(await extension.getActivationState()).toBeUndefined();
});

test('activation and registration survive a service-worker restart', async ({
	context,
	extension,
}) => {
	const optionsPage = await enableArivuno(extension);
	await expectEnabledState(extension);
	const worker = context.serviceWorkers()[0];
	const browser = context.browser();

	if (worker === undefined || browser === null) {
		throw new Error('Chromium extension service worker is unavailable');
	}

	const cdp = await browser.newBrowserCDPSession();
	const {targetInfos} = (await cdp.send('Target.getTargets')) as {
		targetInfos: Array<{targetId: string; type: string; url: string}>;
	};
	const workerTarget = targetInfos.find(
		(target) => target.type === 'service_worker' && target.url === worker.url(),
	);

	if (workerTarget === undefined) {
		throw new Error('Chromium extension service-worker target is unavailable');
	}

	const closeResult = (await cdp.send('Target.closeTarget', {
		targetId: workerTarget.targetId,
	})) as {success: boolean};
	expect(closeResult.success).toBe(true);
	await expect
		.poll(async () => {
			const targets = (await cdp.send('Target.getTargets')) as {
				targetInfos: Array<{targetId: string}>;
			};

			return targets.targetInfos.some(
				(target) => target.targetId === workerTarget.targetId,
			);
		})
		.toBe(false);

	await optionsPage.reload();
	await expect(optionsPage.getByRole('status')).toHaveText(
		'Arivuno is enabled.',
	);
	await expectEnabledState(extension);
	const registrations = await extension.getRegistrations();
	expect(registrations).toHaveLength(1);
	expect(isExpectedYoutubeRegistration(registrations[0])).toBe(true);

	const youtubePage = await context.newPage();
	await youtubePage.goto(YOUTUBE_HOME_URL);
	await expect(
		youtubePage.locator(`html[${ACTIVATION_DOCUMENT_ATTRIBUTE}]`),
	).toHaveCount(1);
	await expect(youtubePage.getByTestId('guide-short')).toBeHidden();
});
