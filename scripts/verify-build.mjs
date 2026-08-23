import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';
import {extname, resolve} from 'node:path';

const outputDirectory = resolve('.output/chrome-mv3');
const packageMetadata = JSON.parse(
	await readFile(resolve('package.json'), 'utf8'),
);
const wxtVersion = packageMetadata.devDependencies?.wxt;

assert.equal(typeof wxtVersion, 'string', 'WXT must be a pinned dependency');
const manifest = JSON.parse(
	await readFile(resolve(outputDirectory, 'manifest.json'), 'utf8'),
);

assert.equal(manifest.manifest_version, 3, 'Manifest V3 is required');
assert.deepEqual(
	Object.keys(manifest).sort(),
	[
		'action',
		'background',
		'content_scripts',
		'description',
		'host_permissions',
		'icons',
		'manifest_version',
		'minimum_chrome_version',
		'name',
		'options_ui',
		'permissions',
		'version',
		'web_accessible_resources',
	],
	'The manifest contains an unexpected capability',
);
assert.deepEqual(
	manifest.permissions ?? [],
	['storage', 'scripting'],
	'Only local activation storage and packaged-script registration are allowed',
);
assert.deepEqual(
	manifest.host_permissions ?? [],
	['https://www.youtube.com/*'],
	'Host access must remain limited to YouTube',
);
assert.equal(
	manifest.minimum_chrome_version,
	'105',
	'The package must not install without required runtime and CSS support',
);
assert.deepEqual(
	manifest.action,
	{default_title: 'Manage Arivuno'},
	'The toolbar action must only open Arivuno management',
);
assert.deepEqual(
	manifest.background,
	{service_worker: 'background.js'},
	'The background must remain a single packaged service worker',
);
assert.deepEqual(
	manifest.options_ui,
	{open_in_tab: true, page: 'options.html'},
	'Activation management must use the reviewed options tab',
);
assert.deepEqual(
	manifest.icons,
	{
		16: 'icon/16.png',
		32: 'icon/32.png',
		48: 'icon/48.png',
		128: 'icon/128.png',
	},
	'Only the reviewed Chromium icon sizes are allowed',
);

for (const [size, path] of Object.entries(manifest.icons)) {
	const icon = await readFile(resolve(outputDirectory, path));

	assert.deepEqual(
		[...icon.subarray(0, 8)],
		[137, 80, 78, 71, 13, 10, 26, 10],
		`Manifest icon is not a PNG: ${path}`,
	);
	assert.equal(
		icon.readUInt32BE(16),
		Number(size),
		`Manifest icon has the wrong width: ${path}`,
	);
	assert.equal(
		icon.readUInt32BE(20),
		Number(size),
		`Manifest icon has the wrong height: ${path}`,
	);
}

const thirdPartyNotices = await readFile(
	resolve(outputDirectory, 'THIRD_PARTY_NOTICES.txt'),
	'utf8',
);
assert.ok(
	thirdPartyNotices.includes(`WXT ${wxtVersion}`),
	'The WXT runtime notice must match the pinned dependency',
);
assert.match(
	thirdPartyNotices,
	/MIT License[\s\S]+Copyright \(c\) 2023 Aaron/,
	'The WXT MIT notice is incomplete',
);

assert.deepEqual(
	manifest.content_scripts,
	[],
	'No content script may run before affirmative activation',
);

assert.deepEqual(
	manifest.web_accessible_resources,
	[
		{
			resources: ['blocked.html'],
			matches: ['https://www.youtube.com/*'],
			use_dynamic_url: true,
		},
	],
	'The web-accessible resource contains an unexpected capability',
);

const runtimeFiles = await listFiles(outputDirectory);
const forbiddenRuntimePrimitives = [
	{pattern: /\bfetch\s*\(/, label: 'fetch'},
	{pattern: /\bXMLHttpRequest\b/, label: 'XMLHttpRequest'},
	{pattern: /\bWebSocket\b/, label: 'WebSocket'},
	{pattern: /\bEventSource\b/, label: 'EventSource'},
	{pattern: /\bWebTransport\b/, label: 'WebTransport'},
	{pattern: /\bRTCPeerConnection\b/, label: 'RTCPeerConnection'},
	{pattern: /\b(?:Shared)?Worker\s*\(/, label: 'Worker'},
	{pattern: /\bimportScripts\s*\(/, label: 'importScripts'},
	{pattern: /\bnew\s+Image\s*\(/, label: 'Image constructor'},
	{
		pattern:
			/createElement\s*\(\s*["'](?:script|img|iframe|video|audio|source|object|embed|link)["']/,
		label: 'dynamic resource element',
	},
	{pattern: /["'\x60]\/\/[A-Za-z0-9]/, label: 'protocol-relative URL'},
	{pattern: /\bsendBeacon\b/, label: 'sendBeacon'},
];

for (const file of runtimeFiles.filter((path) => extname(path) === '.js')) {
	const source = await readFile(file, 'utf8');

	for (const {pattern, label} of forbiddenRuntimePrimitives) {
		assert.doesNotMatch(
			source,
			pattern,
			`Runtime bundle contains forbidden ${label}: ${file}`,
		);
	}

	for (const [remoteUrl] of source.matchAll(/https?:\/\/[^\s"'\x60\\)]+/g)) {
		assert.match(
			remoteUrl,
			/^https:\/\/www\.youtube\.com(?:[/?#*]|$)/,
			`Runtime bundle contains an unexpected remote URL: ${remoteUrl}`,
		);
	}
}

const contentScriptSource = await readFile(
	resolve(outputDirectory, 'content-scripts/youtube.js'),
	'utf8',
);
assert.match(
	contentScriptSource,
	/noScriptStartedPostMessage:(?:!0|true)/,
	'The WXT page-world startup broadcast must be disabled',
);

const contentScriptStyle = await readFile(
	resolve(outputDirectory, 'content-scripts/youtube.css'),
	'utf8',
);
assert.match(
	contentScriptStyle,
	/html\[data-arivuno-enabled\]/,
	'YouTube styles must remain inert without the activation marker',
);

const backgroundSource = await readFile(
	resolve(outputDirectory, 'background.js'),
	'utf8',
);
for (const requiredRegistrationValue of [
	'arivuno-youtube',
	'content-scripts/youtube.js',
	'content-scripts/youtube.css',
	'https://www.youtube.com/*',
]) {
	assert.ok(
		backgroundSource.includes(requiredRegistrationValue),
		`Background registration is missing: ${requiredRegistrationValue}`,
	);
}

const optionsPageHtml = await readFile(
	resolve(outputDirectory, 'options.html'),
	'utf8',
);
assert.match(
	optionsPageHtml,
	/>Enable Arivuno</,
	'The activation page must contain the specific agreeing action',
);
assert.match(
	optionsPageHtml,
	/current YouTube URL/,
	'The activation page must disclose URL processing',
);
assert.doesNotMatch(
	optionsPageHtml,
	/\b(?:src|action|poster|data|ping|formaction)=["'](?:https?:)?\/\//i,
	'The activation page must not load or submit to remote resources',
);

const blockedPageHtml = await readFile(
	resolve(outputDirectory, 'blocked.html'),
	'utf8',
);
assert.doesNotMatch(
	blockedPageHtml,
	/\b(?:src|href|action|poster|data|ping|formaction)=["'](?:https?:)?\/\//i,
	'The interruption page must not load remote assets',
);
assert.doesNotMatch(
	blockedPageHtml,
	/@import\b|url\(\s*["']?(?:https?:)?\/\//i,
	'The interruption page must not contain inline remote assets',
);
assert.doesNotMatch(
	blockedPageHtml,
	/<meta\b[^>]+http-equiv=["']refresh["']/i,
	'The interruption page must not contain a meta refresh',
);

for (const file of runtimeFiles.filter((path) => extname(path) === '.css')) {
	const source = await readFile(file, 'utf8');

	assert.doesNotMatch(
		source,
		/@import\b|url\(\s*["']?(?:https?:)?\/\//i,
		'Stylesheet contains a remote asset reference: ' + file,
	);
}

console.log(
	'Verified activation-gated MV3 capabilities, disabled page broadcast, and no direct transport APIs or remote assets.',
);

async function listFiles(directory) {
	const entries = await readdir(directory, {withFileTypes: true});
	const files = [];

	for (const entry of entries) {
		const path = resolve(directory, entry.name);

		if (entry.isDirectory()) {
			files.push(...(await listFiles(path)));
		} else {
			files.push(path);
		}
	}

	return files;
}
