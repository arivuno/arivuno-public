import type {BrowserContext, Request} from '@playwright/test';

export const VIDEO_ID = 'TEST_ID_001';
export const YOUTUBE_HOME_URL = 'https://www.youtube.com/';
export const SHORT_URL = `${YOUTUBE_HOME_URL}shorts/${VIDEO_ID}`;
export const SHORTS_FEED_URL = `${YOUTUBE_HOME_URL}shorts/`;
export const WATCH_URL = `${YOUTUBE_HOME_URL}watch?v=${VIDEO_ID}`;
export const BLOCKED_PAGE_URL = /^chrome-extension:\/\/[^/]+\/blocked\.html$/;

const YOUTUBE_ORIGIN = new URL(YOUTUBE_HOME_URL).origin;
const HTTP_PROTOCOLS = new Set(['http:', 'https:']);
const BROWSER_INTERNAL_PROTOCOLS = new Set([
	'about:',
	'blob:',
	'chrome:',
	'chrome-extension:',
	'data:',
	'devtools:',
]);

export interface SurfaceCase {
	name: string;
	url: string;
	hiddenTestIds: string[];
	visibleTestId: string;
}

export const SURFACE_CASES: SurfaceCase[] = [
	{
		name: 'Home',
		url: YOUTUBE_HOME_URL,
		hiddenTestIds: [
			'guide-short',
			'mini-guide-short',
			'home-rich-shelf',
			'home-rich-card',
			'home-lockup-v1',
			'home-lockup-v2',
			'home-grid-shelf',
			'home-rich-section',
			'home-absolute-rich-card',
		],
		visibleTestId: 'home-regular-card',
	},
	{
		name: 'Search',
		url: `${YOUTUBE_HOME_URL}results?search_query=shorts`,
		hiddenTestIds: [
			'search-reel-shelf',
			'search-reel-item',
			'search-video',
			'search-grid-video',
			'search-lockup',
		],
		visibleTestId: 'search-regular-video',
	},
	{
		name: 'Subscriptions',
		url: `${YOUTUBE_HOME_URL}feed/subscriptions`,
		hiddenTestIds: [
			'subscriptions-rich-section',
			'subscriptions-playlist-video',
			'subscriptions-menu-item',
		],
		visibleTestId: 'subscriptions-regular-section',
	},
	{
		name: 'Channel',
		url: `${YOUTUBE_HOME_URL}@arivuno`,
		hiddenTestIds: [
			'channel-title-tab',
			'channel-link-tab',
			'channel-paper-tab',
		],
		visibleTestId: 'channel-videos-tab',
	},
	{
		name: 'Watch',
		url: WATCH_URL,
		hiddenTestIds: ['watch-compact-short', 'watch-card-short'],
		visibleTestId: 'regular-player',
	},
];

const EXPECTED_YOUTUBE_DOCUMENT_URLS = new Set([
	...SURFACE_CASES.map((surface) => surface.url),
	SHORT_URL,
	SHORTS_FEED_URL,
]);

export async function installYouTubeFixture(
	context: BrowserContext,
	recordUnexpectedRequest: (description: string) => void,
): Promise<void> {
	const recordedUnexpectedRequests = new WeakSet<Request>();
	const recordUnexpectedRequestOnce = (request: Request): void => {
		if (recordedUnexpectedRequests.has(request)) {
			return;
		}

		recordedUnexpectedRequests.add(request);
		recordUnexpectedRequest(describeRequest(request));
	};

	context.on('request', (request) => {
		const url = new URL(request.url());

		if (
			HTTP_PROTOCOLS.has(url.protocol) &&
			!isExpectedHttpRequest(request, url)
		) {
			recordUnexpectedRequestOnce(request);
		}
	});

	await context.route('**/*', async (route) => {
		const request = route.request();
		const url = new URL(request.url());

		if (BROWSER_INTERNAL_PROTOCOLS.has(url.protocol)) {
			await route.continue();
			return;
		}

		if (isKnownHarmlessBrowserRequest(request, url)) {
			await route.fulfill({status: 204, body: ''});
			return;
		}

		if (isExpectedYouTubeDocument(request, url)) {
			await route.fulfill({
				status: 200,
				contentType: 'text/html; charset=utf-8',
				body: renderYouTubePage(url),
			});
			return;
		}

		recordUnexpectedRequestOnce(request);
		await route.abort('blockedbyclient');
	});
}

function isExpectedHttpRequest(request: Request, url: URL): boolean {
	return (
		isKnownHarmlessBrowserRequest(request, url) ||
		isExpectedYouTubeDocument(request, url)
	);
}

function isExpectedYouTubeDocument(request: Request, url: URL): boolean {
	return (
		HTTP_PROTOCOLS.has(url.protocol) &&
		EXPECTED_YOUTUBE_DOCUMENT_URLS.has(url.href) &&
		request.method() === 'GET' &&
		request.resourceType() === 'document'
	);
}

function isKnownHarmlessBrowserRequest(request: Request, url: URL): boolean {
	return (
		url.origin === YOUTUBE_ORIGIN &&
		url.pathname === '/favicon.ico' &&
		url.search === '' &&
		request.method() === 'GET' &&
		['image', 'other'].includes(request.resourceType())
	);
}

function describeRequest(request: Request): string {
	return `${request.method()} ${request.url()} (${request.resourceType()})`;
}

function renderYouTubePage(url: URL): string {
	if (url.pathname === '/results') {
		return documentShell(
			'Search',
			`
				<ytd-reel-shelf-renderer data-testid="search-reel-shelf">Shorts shelf</ytd-reel-shelf-renderer>
				<ytd-reel-item-renderer data-testid="search-reel-item"><a href="/shorts/${VIDEO_ID}">Short</a></ytd-reel-item-renderer>
				<ytd-video-renderer data-testid="search-video"><a href="/shorts/${VIDEO_ID}">Short</a></ytd-video-renderer>
				<ytd-grid-video-renderer data-testid="search-grid-video"><a href="/shorts/${VIDEO_ID}">Short</a></ytd-grid-video-renderer>
				<yt-lockup-view-model data-testid="search-lockup"><a href="/shorts/${VIDEO_ID}">Short</a></yt-lockup-view-model>
				<ytd-video-renderer data-testid="search-regular-video"><a href="/watch?v=regular001">Regular video</a></ytd-video-renderer>
			`,
		);
	}

	if (url.pathname === '/feed/subscriptions') {
		return documentShell(
			'Subscriptions',
			`
				<ytd-rich-section-renderer data-testid="subscriptions-rich-section"><span>Shorts section</span><ytm-shorts-lockup-view-model-v2><a href="/shorts/${VIDEO_ID}">Short</a></ytm-shorts-lockup-view-model-v2></ytd-rich-section-renderer>
				<ytd-playlist-video-renderer data-testid="subscriptions-playlist-video"><a href="/shorts/${VIDEO_ID}">Short</a></ytd-playlist-video-renderer>
				<ytd-menu-service-item-renderer data-testid="subscriptions-menu-item"><a href="/shorts/${VIDEO_ID}">Short</a></ytd-menu-service-item-renderer>
				<ytd-rich-section-renderer data-testid="subscriptions-regular-section"><a href="/watch?v=regular002">Regular video</a></ytd-rich-section-renderer>
			`,
		);
	}

	if (url.pathname === '/@arivuno') {
		return documentShell(
			'Channel',
			`
				<yt-tab-shape data-testid="channel-title-tab" tab-title="Shorts">Shorts</yt-tab-shape>
				<yt-tab-shape data-testid="channel-link-tab"><a href="/@arivuno/shorts">Shorts</a></yt-tab-shape>
				<tp-yt-paper-tab data-testid="channel-paper-tab"><a href="/@arivuno/shorts">Shorts</a></tp-yt-paper-tab>
				<yt-tab-shape data-testid="channel-videos-tab" tab-title="Videos">Videos</yt-tab-shape>
			`,
		);
	}

	if (url.pathname === '/watch') {
		return documentShell(
			'Watch',
			`
				<main data-testid="regular-player">Regular YouTube player</main>
				<ytd-compact-video-renderer data-testid="watch-compact-short"><a href="/shorts/${VIDEO_ID}">Short</a></ytd-compact-video-renderer>
				<ytd-watch-card-compact-video-renderer data-testid="watch-card-short"><a href="/shorts/${VIDEO_ID}">Short</a></ytd-watch-card-compact-video-renderer>
			`,
		);
	}

	if (url.pathname.startsWith('/shorts')) {
		return documentShell(
			'Unexpected Shorts page',
			'<main data-testid="unexpected-shorts-page">The extension did not interrupt this page.</main>',
		);
	}

	return documentShell(
		'Home',
		`
			<ytd-guide-renderer><ytd-guide-entry-renderer data-testid="guide-short"><span aria-hidden="true">Shorts icon</span><a href="/shorts/">Shorts</a></ytd-guide-entry-renderer></ytd-guide-renderer>
			<ytd-mini-guide-renderer><ytd-mini-guide-entry-renderer data-testid="mini-guide-short"><span aria-hidden="true">Shorts icon</span><a href="/shorts/">Shorts</a></ytd-mini-guide-entry-renderer></ytd-mini-guide-renderer>
			<ytd-rich-shelf-renderer data-testid="home-rich-shelf" is-shorts>Shorts shelf</ytd-rich-shelf-renderer>
			<ytd-rich-item-renderer data-testid="home-rich-card"><a href="/shorts/${VIDEO_ID}">Short</a></ytd-rich-item-renderer>
			<ytm-shorts-lockup-view-model data-testid="home-lockup-v1"><a href="/shorts/${VIDEO_ID}">Short</a></ytm-shorts-lockup-view-model>
			<ytm-shorts-lockup-view-model-v2 data-testid="home-lockup-v2"><a href="/shorts/${VIDEO_ID}">Short</a></ytm-shorts-lockup-view-model-v2>
			<grid-shelf-view-model data-testid="home-grid-shelf"><span>Shorts shelf</span><ytm-shorts-lockup-view-model-v2><a href="/shorts/${VIDEO_ID}">Short</a></ytm-shorts-lockup-view-model-v2></grid-shelf-view-model>
			<ytd-rich-section-renderer data-testid="home-rich-section"><span>Shorts section</span><ytm-shorts-lockup-view-model><a href="/shorts/${VIDEO_ID}">Short</a></ytm-shorts-lockup-view-model></ytd-rich-section-renderer>
			<ytd-rich-item-renderer data-testid="home-absolute-rich-card"><a href="${SHORT_URL}">Absolute Short</a></ytd-rich-item-renderer>
			<ytd-rich-item-renderer data-testid="home-regular-card"><a href="/watch?v=regular000">Regular video</a></ytd-rich-item-renderer>
			<a data-testid="direct-short-link" href="/shorts/${VIDEO_ID}">Open a Short</a>
			<a data-testid="absolute-short-link" href="${SHORT_URL}">Open an absolute Short URL</a>
			<a data-testid="new-tab-short-link" href="/shorts/${VIDEO_ID}" target="_blank">Open a Short in a new tab</a>
			<button data-testid="spa-short-button" type="button">Open a Short through the SPA</button>
			<script>
				document.querySelector('[data-testid="spa-short-button"]').addEventListener('click', () => {
					history.pushState({}, '', '/shorts/${VIDEO_ID}');
				});
			</script>
		`,
	);
}

function documentShell(title: string, body: string): string {
	return `<!doctype html>
		<html lang="en">
			<head><meta charset="utf-8"><title>${title} - YouTube fixture</title></head>
			<body>${body}</body>
		</html>`;
}
