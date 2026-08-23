import {describe, expect, test} from 'vitest';
import {createActivationController} from '../src/activation/controller';
import {
	ACTIVATION_DISCLOSURE_VERSION,
	createEnabledActivationState,
	type EnabledActivationState,
} from '../src/activation/state';

interface HarnessOptions {
	state?: unknown;
	registrationIsExpected?: boolean;
	clearError?: Error;
	registerError?: Error;
	unregisterError?: Error;
	writeError?: Error;
}

function createHarness(options: HarnessOptions = {}) {
	let state = options.state;
	let registrationIsExpected = options.registrationIsExpected ?? false;
	const events: string[] = [];
	const controller = createActivationController({
		readState: async () => {
			events.push('read');
			return state;
		},
		writeState: async (nextState: EnabledActivationState) => {
			events.push('write');

			if (options.writeError !== undefined) {
				throw options.writeError;
			}

			state = nextState;
		},
		clearState: async () => {
			events.push('clear');

			if (options.clearError !== undefined) {
				throw options.clearError;
			}

			state = undefined;
		},
		hasExpectedRegistration: async () => {
			events.push('inspect-registration');
			return registrationIsExpected;
		},
		register: async () => {
			events.push('register');

			if (options.registerError !== undefined) {
				throw options.registerError;
			}

			registrationIsExpected = true;
		},
		unregister: async () => {
			events.push('unregister');

			if (options.unregisterError !== undefined) {
				throw options.unregisterError;
			}

			registrationIsExpected = false;
		},
	});

	return {
		controller,
		events,
		getState: () => state,
		isRegistered: () => registrationIsExpected,
	};
}

describe('activation controller', () => {
	test('registers the packaged script before storing activation', async () => {
		const harness = createHarness();

		await expect(harness.controller.enable()).resolves.toBe(true);
		expect(harness.events).toEqual([
			'read',
			'clear',
			'inspect-registration',
			'unregister',
			'register',
			'write',
		]);
		expect(harness.getState()).toEqual(createEnabledActivationState());
		expect(harness.isRegistered()).toBe(true);
	});

	test('keeps an exact enabled activation unchanged', async () => {
		const state = createEnabledActivationState();
		const harness = createHarness({
			state,
			registrationIsExpected: true,
		});

		await expect(harness.controller.enable()).resolves.toBe(true);
		expect(harness.events).toEqual(['read', 'inspect-registration']);
		expect(harness.getState()).toBe(state);
		expect(harness.isRegistered()).toBe(true);
	});

	test('rolls back registration when the state cannot be stored', async () => {
		const writeError = new Error('storage unavailable');
		const harness = createHarness({writeError});

		await expect(harness.controller.enable()).rejects.toBe(writeError);
		expect(harness.getState()).toBeUndefined();
		expect(harness.isRegistered()).toBe(false);
		expect(harness.events.at(-2)).toBe('clear');
		expect(harness.events.at(-1)).toBe('unregister');
	});

	test('does not store activation when registration fails', async () => {
		const registerError = new Error('registration failed');
		const harness = createHarness({registerError});

		await expect(harness.controller.enable()).rejects.toBe(registerError);
		expect(harness.getState()).toBeUndefined();
		expect(harness.isRegistered()).toBe(false);
	});

	test('attempts registration cleanup when activation clear fails', async () => {
		const clearError = new Error('storage remove failed');
		const state = createEnabledActivationState();
		const harness = createHarness({state, clearError});

		await expect(harness.controller.enable()).rejects.toBe(clearError);
		expect(harness.events).toEqual([
			'read',
			'inspect-registration',
			'clear',
			'clear',
			'unregister',
		]);
		expect(harness.getState()).toBe(state);
		expect(harness.isRegistered()).toBe(false);
	});

	test('removes state before unregistering on disable', async () => {
		const harness = createHarness({
			state: createEnabledActivationState(),
			registrationIsExpected: true,
		});

		await expect(harness.controller.disable()).resolves.toBe(false);
		expect(harness.events).toEqual(['clear', 'unregister']);
		expect(harness.getState()).toBeUndefined();
	});

	test('attempts unregister when state removal fails on disable', async () => {
		const clearError = new Error('storage remove failed');
		const state = createEnabledActivationState();
		const harness = createHarness({
			state,
			registrationIsExpected: true,
			clearError,
		});

		await expect(harness.controller.disable()).rejects.toBe(clearError);
		expect(harness.events).toEqual(['clear', 'unregister']);
		expect(harness.getState()).toBe(state);
		expect(harness.isRegistered()).toBe(false);
	});

	test('keeps missing state fail-closed when unregister fails on disable', async () => {
		const unregisterError = new Error('scripting unavailable');
		const harness = createHarness({
			state: createEnabledActivationState(),
			registrationIsExpected: true,
			unregisterError,
		});

		await expect(harness.controller.disable()).rejects.toBe(unregisterError);
		expect(harness.events).toEqual(['clear', 'unregister']);
		expect(harness.getState()).toBeUndefined();
		expect(harness.isRegistered()).toBe(true);
	});

	test('clears invalid state and stale registration', async () => {
		const harness = createHarness({
			state: {enabled: true, disclosureVersion: 0},
			registrationIsExpected: true,
		});

		await expect(harness.controller.reconcile()).resolves.toBe(false);
		expect(harness.events).toEqual(['read', 'clear', 'unregister']);
		expect(harness.getState()).toBeUndefined();
		expect(harness.isRegistered()).toBe(false);
	});

	test('attempts stale-registration cleanup when invalid-state removal fails', async () => {
		const clearError = new Error('storage remove failed');
		const state = {enabled: true, disclosureVersion: 0};
		const harness = createHarness({
			state,
			registrationIsExpected: true,
			clearError,
		});

		await expect(harness.controller.reconcile()).rejects.toBe(clearError);
		expect(harness.events).toEqual(['read', 'clear', 'unregister']);
		expect(harness.getState()).toBe(state);
		expect(harness.isRegistered()).toBe(false);
	});

	test('keeps an exact valid registration unchanged', async () => {
		const state = createEnabledActivationState();
		const harness = createHarness({
			state,
			registrationIsExpected: true,
		});

		await expect(harness.controller.reconcile()).resolves.toBe(true);
		expect(harness.events).toEqual(['read', 'inspect-registration']);
		expect(harness.getState()).toBe(state);
	});

	test('attempts drift cleanup when valid-state removal fails', async () => {
		const clearError = new Error('storage remove failed');
		const state = createEnabledActivationState();
		const harness = createHarness({state, clearError});

		await expect(harness.controller.reconcile()).rejects.toBe(clearError);
		expect(harness.events).toEqual([
			'read',
			'inspect-registration',
			'clear',
			'clear',
			'unregister',
		]);
		expect(harness.getState()).toBe(state);
		expect(harness.isRegistered()).toBe(false);
	});

	test('temporarily clears valid state while repairing registration drift', async () => {
		const state = {
			enabled: true,
			disclosureVersion: ACTIVATION_DISCLOSURE_VERSION,
		} as const;
		const harness = createHarness({state});

		await expect(harness.controller.reconcile()).resolves.toBe(true);
		expect(harness.events).toEqual([
			'read',
			'inspect-registration',
			'clear',
			'inspect-registration',
			'unregister',
			'register',
			'write',
		]);
		expect(harness.getState()).toEqual(state);
		expect(harness.isRegistered()).toBe(true);
	});
});
