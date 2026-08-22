import {describe, expect, it} from 'vitest';
import {
	buildBlockedPageUrl,
	buildRegularWatchUrl,
	parseShortsTarget,
	readBlockedPageTarget,
} from '../src/youtube/shorts-url';

const VIDEO_ID = 'TEST_ID_001';

describe('parseShortsTarget', () => {
	it('recognizes the Shorts feed', () => {
		expect(parseShortsTarget('https://www.youtube.com/shorts')).toEqual({
			kind: 'feed',
		});
		expect(parseShortsTarget('/shorts/')).toEqual({kind: 'feed'});
	});

	it('recognizes a valid Shorts video URL', () => {
		expect(
			parseShortsTarget(
				`https://www.youtube.com/shorts/${VIDEO_ID}?feature=share`,
			),
		).toEqual({kind: 'video', videoId: VIDEO_ID});
	});

	it('decodes each path segment exactly once before matching', () => {
		expect(
			parseShortsTarget(`https://www.youtube.com/%73horts/%54EST_ID_001`),
		).toEqual({kind: 'video', videoId: VIDEO_ID});
		expect(
			parseShortsTarget(`https://www.youtube.com/%2573horts/${VIDEO_ID}`),
		).toBeNull();
		expect(
			parseShortsTarget(`https://www.youtube.com/shorts/${VIDEO_ID}%2Fextra`),
		).toBeNull();
	});

	it('rejects unrelated, external, and malformed URLs', () => {
		expect(
			parseShortsTarget(`https://www.youtube.com/watch?v=${VIDEO_ID}`),
		).toBeNull();
		expect(
			parseShortsTarget(`https://example.com/shorts/${VIDEO_ID}`),
		).toBeNull();
		expect(
			parseShortsTarget('https://www.youtube.com/shorts/not-valid'),
		).toBeNull();
		expect(
			parseShortsTarget(`https://www.youtube.com/shorts/${VIDEO_ID}/extra`),
		).toBeNull();
	});
});

describe('blocked page fragments', () => {
	it('round-trips a validated video ID without exposing a web URL', () => {
		const blockedUrl = buildBlockedPageUrl(
			'chrome-extension://extension-id/blocked.html?discard=true',
			{kind: 'video', videoId: VIDEO_ID},
		);
		const parsed = new URL(blockedUrl);

		expect(parsed.search).toBe('');
		expect(readBlockedPageTarget(parsed.hash)).toEqual({
			kind: 'video',
			videoId: VIDEO_ID,
		});
	});

	it('fails closed when the fragment is tampered with', () => {
		expect(readBlockedPageTarget('#type=video&video=%3Cscript%3E')).toEqual({
			kind: 'feed',
		});
	});
});

describe('buildRegularWatchUrl', () => {
	it('opens a validated clip in the regular YouTube player', () => {
		expect(buildRegularWatchUrl(VIDEO_ID)).toBe(
			`https://www.youtube.com/watch?v=${VIDEO_ID}`,
		);
	});

	it('rejects an invalid video ID', () => {
		expect(buildRegularWatchUrl('../account')).toBeNull();
	});
});
