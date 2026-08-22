import {describe, expect, it, vi} from 'vitest';

describe('blocked page', () => {
	it('renders a validated clip, scrubs its ID, and falls back when Back is unavailable', async () => {
		document.body.innerHTML = `
      <p id="eyebrow"></p>
      <h1 id="blocked-title"></h1>
      <p id="message"></p>
      <button id="back-button"></button>
      <a id="watch-link"></a>
    `;
		window.history.replaceState(
			{source: 'test'},
			'',
			'/blocked.html#type=video&video=TEST_ID_001',
		);
		const goBack = vi
			.fn()
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error('No page to go back to'));
		vi.stubGlobal('browser', {
			tabs: {goBack},
		});

		await import('../entrypoints/blocked/main');

		expect(window.location.hash).toBe('');
		expect(window.history.state).toEqual({source: 'test'});
		expect(document.querySelector('#blocked-title')?.textContent).toBe(
			'Short blocked',
		);
		expect(document.querySelector<HTMLAnchorElement>('#watch-link')?.href).toBe(
			'https://www.youtube.com/watch?v=TEST_ID_001',
		);

		document.querySelector<HTMLButtonElement>('#back-button')?.click();
		await vi.waitFor(() => {
			expect(goBack).toHaveBeenCalledOnce();
		});
		expect(window.location.pathname).toBe('/blocked.html');

		document.querySelector<HTMLButtonElement>('#back-button')?.click();
		await vi.waitFor(() => {
			expect(goBack).toHaveBeenCalledTimes(2);
			expect(window.location.href).toBe('https://www.youtube.com/');
		});
	});
});
