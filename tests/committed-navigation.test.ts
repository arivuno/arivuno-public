import {describe, expect, it, vi} from 'vitest';
import {checkNavigationAfterCommit} from '../src/youtube/committed-navigation';

describe('checkNavigationAfterCommit', () => {
	it('waits for an SPA transition to commit before handling it', () => {
		let currentUrl = 'https://www.youtube.com/';
		let scheduled: (() => void) | undefined;
		const onCommitted = vi.fn();
		const expectedUrl = new URL('https://www.youtube.com/shorts/TEST_ID_001');

		checkNavigationAfterCommit({
			expectedUrl,
			getCurrentUrl: () => currentUrl,
			schedule: (callback) => {
				scheduled = callback;
			},
			onCommitted,
		});

		expect(onCommitted).not.toHaveBeenCalled();

		currentUrl = expectedUrl.href;
		scheduled?.();

		expect(onCommitted).toHaveBeenCalledOnce();
		expect(onCommitted).toHaveBeenCalledWith(expectedUrl.href);
	});

	it('ignores a cancelled or superseded transition', () => {
		let scheduled: (() => void) | undefined;
		const onCommitted = vi.fn();

		checkNavigationAfterCommit({
			expectedUrl: new URL('https://www.youtube.com/shorts/TEST_ID_001'),
			getCurrentUrl: () => 'https://www.youtube.com/watch?v=TEST_ID_001',
			schedule: (callback) => {
				scheduled = callback;
			},
			onCommitted,
		});

		scheduled?.();

		expect(onCommitted).not.toHaveBeenCalled();
	});
});
