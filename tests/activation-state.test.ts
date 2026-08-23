import {describe, expect, test} from 'vitest';
import {
	ACTIVATION_DISCLOSURE_VERSION,
	createEnabledActivationState,
	isEnabledActivationState,
} from '../src/activation/state';

describe('activation state', () => {
	test('accepts only the exact current enabled record', () => {
		expect(isEnabledActivationState(createEnabledActivationState())).toBe(true);
	});

	test.each([
		undefined,
		null,
		false,
		[],
		{},
		{enabled: false, disclosureVersion: ACTIVATION_DISCLOSURE_VERSION},
		{enabled: true},
		{enabled: true, disclosureVersion: 0},
		{enabled: true, disclosureVersion: ACTIVATION_DISCLOSURE_VERSION + 1},
		{enabled: true, disclosureVersion: String(ACTIVATION_DISCLOSURE_VERSION)},
		{
			enabled: true,
			disclosureVersion: ACTIVATION_DISCLOSURE_VERSION,
			extra: true,
		},
	])('fails closed for %j', (value) => {
		expect(isEnabledActivationState(value)).toBe(false);
	});
});
