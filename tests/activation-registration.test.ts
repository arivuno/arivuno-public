import {describe, expect, test} from 'vitest';
import {
	isExpectedYoutubeRegistration,
	YOUTUBE_CONTENT_SCRIPT_REGISTRATION,
} from '../src/activation/registration';

describe('YouTube content-script registration', () => {
	test('accepts the exact packaged registration and harmless reported defaults', () => {
		expect(
			isExpectedYoutubeRegistration(YOUTUBE_CONTENT_SCRIPT_REGISTRATION),
		).toBe(true);
		expect(
			isExpectedYoutubeRegistration({
				...YOUTUBE_CONTENT_SCRIPT_REGISTRATION,
				excludeMatches: [],
				includeGlobs: [],
				excludeGlobs: [],
				matchOriginAsFallback: false,
				world: 'ISOLATED',
			}),
		).toBe(true);
	});

	test.each([
		['id', 'other-script'],
		['matches', ['https://example.com/*']],
		['js', ['other.js']],
		['css', ['other.css']],
		['runAt', 'document_idle'],
		['allFrames', true],
		['persistAcrossSessions', false],
		['excludeMatches', ['https://www.youtube.com/shorts/*']],
		['includeGlobs', ['*shorts*']],
		['excludeGlobs', ['*watch*']],
		['matchOriginAsFallback', true],
		['world', 'MAIN'],
	] as const)('rejects a changed %s field', (field, value) => {
		expect(
			isExpectedYoutubeRegistration({
				...YOUTUBE_CONTENT_SCRIPT_REGISTRATION,
				[field]: value,
			}),
		).toBe(false);
	});
});
