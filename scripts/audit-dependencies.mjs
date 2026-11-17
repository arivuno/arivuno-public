import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const severities = new Set(['info', 'low', 'moderate', 'high', 'critical']);

function isObject(value) {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function assessAudit(stdout, status) {
	assert(
		typeof stdout === 'string' && stdout.trim(),
		'Audit returned no JSON report',
	);
	const report = JSON.parse(stdout);
	assert(isObject(report), 'Audit report must be an object');
	const entries = Object.entries(report);
	assert.equal(
		status,
		entries.length === 0 ? 0 : 1,
		'Audit process failed or returned an inconsistent report',
	);
	const findings = [];
	for (const [name, advisories] of entries) {
		assert(
			name.trim() && Array.isArray(advisories) && advisories.length > 0,
			'Invalid audit package entry',
		);
		for (const advisory of advisories) {
			assert(isObject(advisory), 'Invalid audit advisory');
			assert(
				Number.isSafeInteger(advisory.id) && advisory.id > 0,
				'Invalid advisory ID',
			);
			for (const field of ['url', 'title', 'vulnerable_versions']) {
				assert(
					typeof advisory[field] === 'string' && advisory[field].trim(),
					`Invalid advisory ${field}`,
				);
			}
			assert(severities.has(advisory.severity), 'Invalid advisory severity');
			findings.push({package: name, advisory});
		}
	}
	return findings;
}

function main() {
	assert(globalThis.Bun, 'Run this audit with the configured Bun runtime');
	const manifest = JSON.parse(
		readFileSync(path.join(root, 'package.json'), 'utf8'),
	);
	assert.equal(
		`bun@${globalThis.Bun.version}`,
		manifest.packageManager,
		'Use the Bun version configured in package.json for the audit protocol',
	);
	// Audit the full lockfile before installing dependencies or running their scripts.
	const result = spawnSync(process.execPath, ['audit', '--json'], {
		cwd: root,
		encoding: 'utf8',
		timeout: 60_000,
		maxBuffer: 8 * 1024 * 1024,
		windowsHide: true,
	});
	if (result.stderr) process.stderr.write(result.stderr);
	if (result.error) throw result.error;
	assert(!result.signal, 'Audit process terminated by signal');
	const findings = assessAudit(result.stdout, result.status);
	if (findings.length) {
		console.error(JSON.stringify(findings, null, 2));
		process.exitCode = 1;
	} else {
		console.log('Dependency audit passed (no findings).');
	}
}

if (
	process.argv[1] &&
	path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	try {
		main();
	} catch (error) {
		console.error(`Dependency audit failed: ${error.message}`);
		process.exitCode = 1;
	}
}
