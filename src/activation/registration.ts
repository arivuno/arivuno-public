export const YOUTUBE_CONTENT_SCRIPT_ID = 'arivuno-youtube';
export const YOUTUBE_MATCH_PATTERN = 'https://www.youtube.com/*';

export const YOUTUBE_CONTENT_SCRIPT_REGISTRATION = {
	id: YOUTUBE_CONTENT_SCRIPT_ID,
	matches: [YOUTUBE_MATCH_PATTERN],
	js: ['content-scripts/youtube.js'],
	css: ['content-scripts/youtube.css'],
	runAt: 'document_start' as const,
	allFrames: false,
	persistAcrossSessions: true,
};

export function isExpectedYoutubeRegistration(value: unknown): boolean {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return false;
	}

	const registration = value as Record<string, unknown>;

	return (
		registration.id === YOUTUBE_CONTENT_SCRIPT_REGISTRATION.id &&
		hasExactStrings(
			registration.matches,
			YOUTUBE_CONTENT_SCRIPT_REGISTRATION.matches,
		) &&
		hasExactStrings(registration.js, YOUTUBE_CONTENT_SCRIPT_REGISTRATION.js) &&
		hasExactStrings(
			registration.css,
			YOUTUBE_CONTENT_SCRIPT_REGISTRATION.css,
		) &&
		registration.runAt === YOUTUBE_CONTENT_SCRIPT_REGISTRATION.runAt &&
		(registration.allFrames === false ||
			registration.allFrames === undefined) &&
		(registration.persistAcrossSessions === true ||
			registration.persistAcrossSessions === undefined) &&
		isAbsentOrEmpty(registration.excludeMatches) &&
		isAbsentOrEmpty(registration.includeGlobs) &&
		isAbsentOrEmpty(registration.excludeGlobs) &&
		(registration.matchOriginAsFallback === false ||
			registration.matchOriginAsFallback === undefined) &&
		(registration.world === 'ISOLATED' || registration.world === undefined)
	);
}

function hasExactStrings(value: unknown, expected: readonly string[]): boolean {
	return (
		Array.isArray(value) &&
		value.length === expected.length &&
		value.every((entry, index) => entry === expected[index])
	);
}

function isAbsentOrEmpty(value: unknown): boolean {
	return value === undefined || (Array.isArray(value) && value.length === 0);
}
