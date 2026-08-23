import {
	ACTIVATION_DISABLE_MESSAGE,
	ACTIVATION_ENABLE_MESSAGE,
	ACTIVATION_GET_MESSAGE,
	isActivationResponse,
	type ActivationCommand,
} from '../../src/activation/protocol';
import {
	ACTIVATION_STORAGE_KEY,
	isEnabledActivationState,
} from '../../src/activation/state';

const ACTIVATION_ERROR_MESSAGE =
	'Arivuno could not update its local activation. Try again.';
const card = requireElement<HTMLElement>('manage-card');
const status = requireElement<HTMLParagraphElement>('status');
const error = requireElement<HTMLParagraphElement>('error');
const offActions = requireElement<HTMLDivElement>('off-actions');
const onActions = requireElement<HTMLDivElement>('on-actions');
const reloadNote = requireElement<HTMLParagraphElement>('reload-note');
const enableButton = requireElement<HTMLButtonElement>('enable-button');
const notNowButton = requireElement<HTMLButtonElement>('not-now-button');
const disableButton = requireElement<HTMLButtonElement>('disable-button');
const buttons = [enableButton, notNowButton, disableButton];
let hasKnownStatus = false;
let stateRevision = 0;

enableButton.addEventListener('click', () => {
	void sendActivationCommand(ACTIVATION_ENABLE_MESSAGE);
});
disableButton.addEventListener('click', () => {
	void sendActivationCommand(ACTIVATION_DISABLE_MESSAGE);
});
notNowButton.addEventListener('click', () => {
	window.close();
});
browser.storage.onChanged.addListener((changes, areaName) => {
	const change = changes[ACTIVATION_STORAGE_KEY];

	if (areaName === 'local' && change !== undefined) {
		stateRevision += 1;
		render(isEnabledActivationState(change.newValue));
	}
});

void sendActivationCommand(ACTIVATION_GET_MESSAGE);

async function sendActivationCommand(
	type: ActivationCommand['type'],
): Promise<void> {
	const requestRevision = stateRevision;
	setBusy(true);
	clearError();

	try {
		const response: unknown = await browser.runtime.sendMessage({type});

		if (!isActivationResponse(response)) {
			throw new Error(ACTIVATION_ERROR_MESSAGE);
		}
		if (stateRevision !== requestRevision) {
			return;
		}

		if (!response.ok) {
			showError(response.message);
			return;
		}

		render(response.enabled);
	} catch {
		if (stateRevision !== requestRevision) {
			return;
		}

		if (!hasKnownStatus) {
			status.textContent = 'Arivuno activation status is unavailable.';
		}

		showError(ACTIVATION_ERROR_MESSAGE);
	} finally {
		setBusy(false);
	}
}

function render(enabled: boolean): void {
	hasKnownStatus = true;
	status.textContent = enabled
		? 'Arivuno is enabled.'
		: 'Arivuno is off. It does not inspect or change YouTube pages.';
	offActions.hidden = enabled;
	onActions.hidden = !enabled;
	reloadNote.hidden = !enabled;
}

function setBusy(busy: boolean): void {
	card.setAttribute('aria-busy', String(busy));

	for (const button of buttons) {
		button.disabled = busy;
	}
}

function clearError(): void {
	error.hidden = true;
	error.textContent = '';
}

function showError(message: string): void {
	error.textContent = message;
	error.hidden = false;
}

function requireElement<T extends HTMLElement>(id: string): T {
	const element = document.getElementById(id);

	if (element === null) {
		throw new Error(`Missing required element: #${id}`);
	}

	return element as T;
}
