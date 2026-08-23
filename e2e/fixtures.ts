import {access, mkdtemp, readFile, rm} from 'node:fs/promises';
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
import {
	ACTIVATION_STORAGE_KEY,
	createEnabledActivationState,
} from '../src/activation/state';
import {isExpectedYoutubeRegistration} from '../src/activation/registration';
import {installYouTubeFixture} from './youtube-fixture';

const extensionPath = resolve('.output/chrome-mv3');

interface ExtensionStorageApi {
	get: (key: string) => Promise<Record<string, unknown>>;
	set: (values: Record<string, unknown>) => Promise<void>;
}

interface ExtensionScriptingApi {
	getRegisteredContentScripts: (filter?: {
		ids?: string[];
	}) => Promise<unknown[]>;
}

interface ExtensionPageGlobal {
	chrome: {
		storage: {local: ExtensionStorageApi};
		scripting: ExtensionScriptingApi;
	};
}

export interface ExtensionTestApi {
	id: string;
	optionsUrl: string;
	waitForInstalledOptionsPage: () => Promise<Page>;
	openOptionsPage: () => Promise<Page>;
	getActivationState: () => Promise<unknown>;
	setActivationState: (state: unknown) => Promise<void>;
	getRegistrations: () => Promise<unknown[]>;
}

export const test = base.extend<{
	context: BrowserContext;
	extension: ExtensionTestApi;
}>({
	context: async ({browserName}, use) => {
		expect(browserName).toBe('chromium');
		await access(resolve(extensionPath, 'manifest.json'));
		const profilePath = await mkdtemp(join(tmpdir(), 'arivuno-e2e-'));
		const runtimeErrors: string[] = [];
		const unexpectedNetworkRequests: string[] = [];
		const context = await launchExtensionContext(
			profilePath,
			(description) => {
				unexpectedNetworkRequests.push(description);
			},
			(description) => {
				runtimeErrors.push(description);
			},
		);
		const installedExtension = await createExtensionTestApi(context);
		await installedExtension.waitForInstalledOptionsPage();

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
	extension: async ({context}, use) => {
		await use(await createExtensionTestApi(context));
	},
});

export {expect};

async function launchExtensionContext(
	profilePath: string,
	recordUnexpectedRequest: (description: string) => void,
	recordRuntimeError: (description: string) => void,
): Promise<BrowserContext> {
	const context = await chromium.launchPersistentContext(profilePath, {
		channel: 'chromium',
		headless: true,
		viewport: {width: 1280, height: 800},
		args: [
			`--disable-extensions-except=${extensionPath}`,
			`--load-extension=${extensionPath}`,
		],
	});

	await installYouTubeFixture(context, recordUnexpectedRequest);

	const recordPageErrors = (page: Page): void => {
		page.on('console', (message: ConsoleMessage) => {
			if (message.type() === 'error') {
				recordRuntimeError(`console: ${message.text()}`);
			}
		});
		page.on('pageerror', (error) => {
			recordRuntimeError(`pageerror: ${error.message}`);
		});
	};

	for (const page of context.pages()) {
		recordPageErrors(page);
	}
	context.on('page', recordPageErrors);
	context.on('weberror', (webError) => {
		recordRuntimeError(`weberror: ${webError.error().message}`);
	});

	return context;
}

async function createExtensionTestApi(
	context: BrowserContext,
): Promise<ExtensionTestApi> {
	const serviceWorker =
		context.serviceWorkers()[0] ??
		(await context.waitForEvent('serviceworker', {timeout: 5_000}));
	const id = new URL(serviceWorker.url()).host;
	const manifest = JSON.parse(
		await readFile(resolve(extensionPath, 'manifest.json'), 'utf8'),
	) as {options_ui?: {page?: unknown}};
	const optionsPage = manifest.options_ui?.page;

	if (typeof optionsPage !== 'string') {
		throw new Error('Built extension is missing options_ui.page');
	}

	const optionsUrl = `chrome-extension://${id}/${optionsPage}`;
	const findOptionsPage = (): Page | undefined =>
		context.pages().find((page) => page.url() === optionsUrl);
	const waitForInstalledOptionsPage = async (): Promise<Page> => {
		await expect.poll(() => findOptionsPage() !== undefined).toBe(true);

		const page = findOptionsPage();

		if (page === undefined) {
			throw new Error('Installation did not open the options page');
		}

		await page.waitForLoadState('domcontentloaded');
		return page;
	};
	const openOptionsPage = async (): Promise<Page> => {
		const existingPage = findOptionsPage();

		if (existingPage !== undefined) {
			await existingPage.waitForLoadState('domcontentloaded');
			return existingPage;
		}

		const page = await context.newPage();
		await page.goto(optionsUrl);
		return page;
	};
	const getActivationState = async (): Promise<unknown> => {
		const page = await openOptionsPage();

		return page.evaluate(async (key) => {
			const extensionGlobal = globalThis as unknown as ExtensionPageGlobal;
			const result = await extensionGlobal.chrome.storage.local.get(key);

			return result[key];
		}, ACTIVATION_STORAGE_KEY);
	};
	const setActivationState = async (state: unknown): Promise<void> => {
		const page = await openOptionsPage();

		await page.evaluate(
			async ({key, value}) => {
				const extensionGlobal = globalThis as unknown as ExtensionPageGlobal;

				await extensionGlobal.chrome.storage.local.set({[key]: value});
			},
			{key: ACTIVATION_STORAGE_KEY, value: state},
		);
	};
	const getRegistrations = async (): Promise<unknown[]> => {
		const page = await openOptionsPage();

		return page.evaluate(async () => {
			const extensionGlobal = globalThis as unknown as ExtensionPageGlobal;

			return extensionGlobal.chrome.scripting.getRegisteredContentScripts();
		});
	};

	return {
		id,
		optionsUrl,
		waitForInstalledOptionsPage,
		openOptionsPage,
		getActivationState,
		setActivationState,
		getRegistrations,
	};
}

export async function enableArivuno(
	extension: ExtensionTestApi,
): Promise<Page> {
	const optionsPage = await extension.openOptionsPage();
	await optionsPage.getByRole('button', {name: 'Enable Arivuno'}).click();
	await expect(optionsPage.getByRole('status')).toHaveText(
		'Arivuno is enabled.',
	);
	await expect
		.poll(async () => {
			const registrations = await extension.getRegistrations();

			return (
				registrations.length === 1 &&
				isExpectedYoutubeRegistration(registrations[0])
			);
		})
		.toBe(true);

	return optionsPage;
}

export async function expectEnabledState(
	extension: ExtensionTestApi,
): Promise<void> {
	const state = await extension.getActivationState();

	expect(state).toEqual(createEnabledActivationState());
}
