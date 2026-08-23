export const ACTIVATION_STORAGE_KEY = 'arivunoActivation';
export const ACTIVATION_DISCLOSURE_VERSION = 1;
export const ACTIVATION_DOCUMENT_ATTRIBUTE = 'data-arivuno-enabled';

export interface EnabledActivationState {
	enabled: true;
	disclosureVersion: typeof ACTIVATION_DISCLOSURE_VERSION;
}

export function createEnabledActivationState(): EnabledActivationState {
	return {
		enabled: true,
		disclosureVersion: ACTIVATION_DISCLOSURE_VERSION,
	};
}

export function isEnabledActivationState(
	value: unknown,
): value is EnabledActivationState {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return false;
	}

	const record = value as Record<string, unknown>;
	const keys = Object.keys(record).sort();

	return (
		keys.length === 2 &&
		keys[0] === 'disclosureVersion' &&
		keys[1] === 'enabled' &&
		record.enabled === true &&
		record.disclosureVersion === ACTIVATION_DISCLOSURE_VERSION
	);
}
