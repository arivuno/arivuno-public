import {
	createEnabledActivationState,
	isEnabledActivationState,
	type EnabledActivationState,
} from './state';

export interface ActivationControllerDependencies {
	readState: () => Promise<unknown>;
	writeState: (state: EnabledActivationState) => Promise<void>;
	clearState: () => Promise<void>;
	hasExpectedRegistration: () => Promise<boolean>;
	register: () => Promise<void>;
	unregister: () => Promise<void>;
}

export interface ActivationController {
	enable: () => Promise<boolean>;
	disable: () => Promise<boolean>;
	reconcile: () => Promise<boolean>;
}

export function createActivationController(
	dependencies: ActivationControllerDependencies,
): ActivationController {
	let queue: Promise<void> = Promise.resolve();

	const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
		const result = queue.then(operation, operation);

		queue = result.then(
			() => undefined,
			() => undefined,
		);

		return result;
	};

	const unregister = async (): Promise<void> => {
		await dependencies.unregister();
	};

	const ensureExpectedRegistration = async (): Promise<void> => {
		if (await dependencies.hasExpectedRegistration()) {
			return;
		}

		await unregister();
		await dependencies.register();
	};

	const clearStateAndUnregister = async (): Promise<void> => {
		let clearFailed = false;
		let clearError: unknown;

		try {
			await dependencies.clearState();
		} catch (error) {
			clearFailed = true;
			clearError = error;
		}

		try {
			await unregister();
		} catch (error) {
			if (clearFailed) {
				throw clearError;
			}

			throw error;
		}

		if (clearFailed) {
			throw clearError;
		}
	};

	const rollbackActivation = async (): Promise<void> => {
		try {
			await clearStateAndUnregister();
		} catch {
			// Best-effort rollback has already attempted both cleanup operations. A
			// later reconciliation attempt will retry anything that still failed.
		}
	};

	const enable = (): Promise<boolean> =>
		enqueue(async () => {
			const storedState = await dependencies.readState();

			if (
				isEnabledActivationState(storedState) &&
				(await dependencies.hasExpectedRegistration())
			) {
				return true;
			}

			const enabledState = createEnabledActivationState();

			try {
				await dependencies.clearState();
				await ensureExpectedRegistration();
				await dependencies.writeState(enabledState);
			} catch (error) {
				await rollbackActivation();
				throw error;
			}

			return true;
		});

	const disable = (): Promise<boolean> =>
		enqueue(async () => {
			await clearStateAndUnregister();
			return false;
		});

	const reconcile = (): Promise<boolean> =>
		enqueue(async () => {
			const storedState = await dependencies.readState();

			if (!isEnabledActivationState(storedState)) {
				if (storedState !== undefined) {
					await clearStateAndUnregister();
				} else {
					await unregister();
				}

				return false;
			}

			if (await dependencies.hasExpectedRegistration()) {
				return true;
			}

			try {
				await dependencies.clearState();
				await ensureExpectedRegistration();
				await dependencies.writeState(storedState);
			} catch (error) {
				await rollbackActivation();
				throw error;
			}

			return true;
		});

	return {enable, disable, reconcile};
}
