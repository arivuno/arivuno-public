import {createActivationController} from '../src/activation/controller';
import {
	ACTIVATION_ENABLE_MESSAGE,
	ACTIVATION_GET_MESSAGE,
	isActivationCommand,
	type ActivationCommand,
	type ActivationResponse,
} from '../src/activation/protocol';
import {
	isExpectedYoutubeRegistration,
	YOUTUBE_CONTENT_SCRIPT_ID,
	YOUTUBE_CONTENT_SCRIPT_REGISTRATION,
} from '../src/activation/registration';
import {ACTIVATION_STORAGE_KEY} from '../src/activation/state';

const ACTIVATION_ERROR_MESSAGE =
	'Arivuno could not update its local activation. Try again.';

export default defineBackground(() => {
	const controller = createActivationController({
		readState: async () => {
			const result = await browser.storage.local.get(ACTIVATION_STORAGE_KEY);

			return result[ACTIVATION_STORAGE_KEY];
		},
		writeState: async (state) => {
			await browser.storage.local.set({[ACTIVATION_STORAGE_KEY]: state});
		},
		clearState: async () => {
			await browser.storage.local.remove(ACTIVATION_STORAGE_KEY);
		},
		hasExpectedRegistration: async () => {
			const registrations = await browser.scripting.getRegisteredContentScripts(
				{
					ids: [YOUTUBE_CONTENT_SCRIPT_ID],
				},
			);

			return (
				registrations.length === 1 &&
				isExpectedYoutubeRegistration(registrations[0])
			);
		},
		register: async () => {
			await browser.scripting.registerContentScripts([
				YOUTUBE_CONTENT_SCRIPT_REGISTRATION,
			]);
		},
		unregister: async () => {
			const registrations = await browser.scripting.getRegisteredContentScripts(
				{
					ids: [YOUTUBE_CONTENT_SCRIPT_ID],
				},
			);

			if (registrations.length > 0) {
				await browser.scripting.unregisterContentScripts({
					ids: [YOUTUBE_CONTENT_SCRIPT_ID],
				});
			}
		},
	});

	const reconcile = (): void => {
		void controller.reconcile().catch(() => undefined);
	};

	browser.runtime.onInstalled.addListener(({reason}) => {
		if (reason === 'install') {
			void controller
				.disable()
				.catch(() => undefined)
				.then(() => browser.runtime.openOptionsPage())
				.catch(() => undefined);
			return;
		}

		reconcile();
	});

	browser.runtime.onStartup.addListener(reconcile);
	browser.action.onClicked.addListener(() => {
		void browser.runtime.openOptionsPage().catch(() => undefined);
	});
	const optionsPageUrl = browser.runtime.getURL('/options.html');
	const handleActivationCommand = async (
		message: ActivationCommand,
	): Promise<ActivationResponse> => {
		try {
			if (message.type === ACTIVATION_GET_MESSAGE) {
				return {ok: true, enabled: await controller.reconcile()};
			}

			if (message.type === ACTIVATION_ENABLE_MESSAGE) {
				return {ok: true, enabled: await controller.enable()};
			}

			return {ok: true, enabled: await controller.disable()};
		} catch {
			return {ok: false, message: ACTIVATION_ERROR_MESSAGE};
		}
	};

	browser.runtime.onMessage.addListener(
		(message: unknown, sender, sendResponse): true | undefined => {
			if (!isActivationCommand(message) || sender.url !== optionsPageUrl) {
				return undefined;
			}

			void handleActivationCommand(message).then((response) => {
				sendResponse(response);
			});

			return true;
		},
	);
});
