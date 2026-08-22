import {describe, expect, it} from 'vitest';
import {createBlockedPageModel} from '../src/youtube/blocked-page-model';

describe('createBlockedPageModel', () => {
	it('offers a regular-player link for one validated clip', () => {
		const model = createBlockedPageModel('#type=video&video=TEST_ID_001');

		expect(model.title).toBe('Short blocked');
		expect(model.watchUrl).toBe('https://www.youtube.com/watch?v=TEST_ID_001');
	});

	it('does not offer a bypass for the Shorts feed', () => {
		const model = createBlockedPageModel('#type=feed');

		expect(model.title).toBe('Shorts feed blocked');
		expect(model.watchUrl).toBeNull();
	});

	it('fails closed for an invalid fragment', () => {
		expect(
			createBlockedPageModel('#type=video&video=javascript').watchUrl,
		).toBeNull();
	});
});
