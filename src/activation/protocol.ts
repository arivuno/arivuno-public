export const ACTIVATION_GET_MESSAGE = 'arivuno:activation:get';
export const ACTIVATION_ENABLE_MESSAGE = 'arivuno:activation:enable';
export const ACTIVATION_DISABLE_MESSAGE = 'arivuno:activation:disable';

export type ActivationCommand =
	| {type: typeof ACTIVATION_GET_MESSAGE}
	| {type: typeof ACTIVATION_ENABLE_MESSAGE}
	| {type: typeof ACTIVATION_DISABLE_MESSAGE};

export type ActivationResponse =
	{ok: true; enabled: boolean} | {ok: false; message: string};

export function isActivationCommand(
	value: unknown,
): value is ActivationCommand {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return false;
	}

	const record = value as Record<string, unknown>;

	return (
		Object.keys(record).length === 1 &&
		(record.type === ACTIVATION_GET_MESSAGE ||
			record.type === ACTIVATION_ENABLE_MESSAGE ||
			record.type === ACTIVATION_DISABLE_MESSAGE)
	);
}

export function isActivationResponse(
	value: unknown,
): value is ActivationResponse {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return false;
	}

	const record = value as Record<string, unknown>;

	return record.ok === true
		? typeof record.enabled === 'boolean'
		: record.ok === false && typeof record.message === 'string';
}
