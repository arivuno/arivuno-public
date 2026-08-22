export const YOUTUBE_ORIGIN = 'https://www.youtube.com';
export const YOUTUBE_HOME_URL = `${YOUTUBE_ORIGIN}/`;

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export type ShortsTarget = {kind: 'feed'} | {kind: 'video'; videoId: string};

export function isValidYouTubeVideoId(value: string): boolean {
	return VIDEO_ID_PATTERN.test(value);
}

export function parseShortsTarget(input: string | URL): ShortsTarget | null {
	const url = toUrl(input);

	if (url === null || url.origin !== YOUTUBE_ORIGIN) {
		return null;
	}

	const segments = decodePathSegments(url.pathname);

	if (segments === null) {
		return null;
	}

	if (segments[0] !== 'shorts') {
		return null;
	}

	if (segments.length === 1) {
		return {kind: 'feed'};
	}

	const videoId = segments[1];

	if (
		segments.length !== 2 ||
		videoId === undefined ||
		!isValidYouTubeVideoId(videoId)
	) {
		return null;
	}

	return {kind: 'video', videoId};
}

export function buildBlockedPageUrl(
	blockedPageUrl: string,
	target: ShortsTarget,
): string {
	const url = new URL(blockedPageUrl);
	const fragment = new URLSearchParams({type: target.kind});

	if (target.kind === 'video') {
		fragment.set('video', target.videoId);
	}

	url.search = '';
	url.hash = fragment.toString();
	return url.toString();
}

export function readBlockedPageTarget(hash: string): ShortsTarget {
	const fragment = new URLSearchParams(hash.replace(/^#/, ''));
	const videoId = fragment.get('video');

	if (
		fragment.get('type') === 'video' &&
		videoId !== null &&
		isValidYouTubeVideoId(videoId)
	) {
		return {kind: 'video', videoId};
	}

	return {kind: 'feed'};
}

export function buildRegularWatchUrl(videoId: string): string | null {
	if (!isValidYouTubeVideoId(videoId)) {
		return null;
	}

	const url = new URL('/watch', YOUTUBE_ORIGIN);
	url.searchParams.set('v', videoId);
	return url.toString();
}

function toUrl(input: string | URL): URL | null {
	if (input instanceof URL) {
		return input;
	}

	try {
		return new URL(input, YOUTUBE_ORIGIN);
	} catch {
		return null;
	}
}

function decodePathSegments(pathname: string): string[] | null {
	try {
		return pathname.split('/').filter(Boolean).map(decodeURIComponent);
	} catch {
		return null;
	}
}
