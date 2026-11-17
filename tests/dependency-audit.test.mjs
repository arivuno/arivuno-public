import assert from 'node:assert/strict';
import {test} from 'node:test';
import {assessAudit} from '../scripts/audit-dependencies.mjs';

const advisory = {
	id: 1,
	url: 'https://example.test/advisories/1',
	title: 'A dependency vulnerability',
	severity: 'high',
	vulnerable_versions: '<2.0.0',
};

await test('an explicit empty report with exit zero is a valid clean audit', () => {
	assert.deepEqual(assessAudit('{}', 0), []);
});

await test('every advisory for every package is retained', () => {
	const second = {...advisory, id: 2};
	assert.deepEqual(
		assessAudit(
			JSON.stringify({first: [advisory, second], other: [advisory]}),
			1,
		),
		[
			{package: 'first', advisory},
			{package: 'first', advisory: second},
			{package: 'other', advisory},
		],
	);
});

for (const severity of ['info', 'low', 'moderate', 'high', 'critical']) {
	await test(`valid ${severity} findings survive assessment`, () => {
		const finding = {...advisory, severity};
		assert.deepEqual(assessAudit(JSON.stringify({dependency: [finding]}), 1), [
			{package: 'dependency', advisory: finding},
		]);
	});
}

for (const [label, stdout] of [
	['empty output', ''],
	['whitespace only', ' \n\t'],
	['malformed JSON', '{'],
	['text surrounding JSON', 'Audit successful\n{}'],
	['null', 'null'],
	['array', '[]'],
	['boolean', 'true'],
	['string', '"clean"'],
	['number', '0'],
	['empty package name', JSON.stringify({'': [advisory]})],
	['whitespace package name', JSON.stringify({' \t': [advisory]})],
	['empty advisory array', '{"dependency":[]}'],
	['nonarray package value', '{"dependency":{}}'],
	['null package value', '{"dependency":null}'],
	['null advisory', '{"dependency":[null]}'],
	['string advisory', '{"dependency":["GHSA-placeholder"]}'],
	['array advisory', '{"dependency":[[]]}'],
	['empty advisory object', '{"dependency":[{}]}'],
]) {
	await test(`invalid audit output fails closed: ${label}`, () => {
		for (const status of [0, 1]) {
			assert.throws(() => assessAudit(stdout, status), Error);
		}
	});
}

/** @type {[keyof typeof advisory, unknown[]][]} */
const malformedFields = [
	['id', [undefined, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '1']],
	['url', [undefined, '', '   ', 42]],
	['title', [undefined, '', '   ', 42]],
	['severity', [undefined, '', 'unknown', 'HIGH', 42]],
	['vulnerable_versions', [undefined, '', '   ', 42]],
];
for (const [field, values] of malformedFields) {
	await test(`a malformed advisory ${field} fails closed`, () => {
		for (const value of values) {
			const finding = {...advisory, [field]: value};
			assert.throws(
				() => assessAudit(JSON.stringify({dependency: [finding]}), 1),
				Error,
			);
		}
	});
}

await test('a valid advisory does not mask a malformed second entry', () => {
	assert.throws(
		() => assessAudit(JSON.stringify({dependency: [advisory, {}]}), 1),
		Error,
	);
});

for (const [label, stdout, status] of [
	['clean JSON with audit exit one', '{}', 1],
	['findings with exit zero', JSON.stringify({dependency: [advisory]}), 0],
	['valid report with exit two', JSON.stringify({dependency: [advisory]}), 2],
	['clean JSON with exit two', '{}', 2],
	['network error text', 'error: unable to connect to registry.npmjs.org', 1],
	['terminated process', '{}', null],
]) {
	await test(`audit failure or status mismatch fails closed: ${label}`, () => {
		assert.throws(() => assessAudit(stdout, status), Error);
	});
}
