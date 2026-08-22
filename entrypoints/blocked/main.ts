import {createBlockedPageModel} from '../../src/youtube/blocked-page-model';
import {YOUTUBE_HOME_URL} from '../../src/youtube/shorts-url';

const model = createBlockedPageModel(window.location.hash);

// The fragment carries only the validated video ID needed to render this page.
// Remove it from the current history entry as soon as it has been consumed.
window.history.replaceState(
	window.history.state,
	'',
	`${window.location.pathname}${window.location.search}`,
);

const eyebrow = requireElement<HTMLParagraphElement>('eyebrow');
const title = requireElement<HTMLHeadingElement>('blocked-title');
const message = requireElement<HTMLParagraphElement>('message');
const backButton = requireElement<HTMLButtonElement>('back-button');
const watchLink = requireElement<HTMLAnchorElement>('watch-link');

eyebrow.textContent = model.eyebrow;
title.textContent = model.title;
message.textContent = model.message;

if (model.watchUrl === null) {
	watchLink.hidden = true;
} else {
	watchLink.href = model.watchUrl;
}

backButton.addEventListener('click', async () => {
	try {
		// The Tabs API checks the complete tab history, including cross-origin
		// entries, and rejects when there is no page behind the current entry.
		await browser.tabs.goBack();
	} catch {
		window.location.replace(YOUTUBE_HOME_URL);
	}
});

backButton.focus();

function requireElement<T extends HTMLElement>(id: string): T {
	const element = document.getElementById(id);

	if (element === null) {
		throw new Error(`Missing required element: #${id}`);
	}

	return element as T;
}
