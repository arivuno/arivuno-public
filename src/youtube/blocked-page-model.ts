import {buildRegularWatchUrl, readBlockedPageTarget} from './shorts-url';

export interface BlockedPageModel {
	eyebrow: string;
	title: string;
	message: string;
	watchUrl: string | null;
}

export function createBlockedPageModel(hash: string): BlockedPageModel {
	const target = readBlockedPageTarget(hash);

	if (target.kind === 'video') {
		return {
			eyebrow: 'YouTube Short',
			title: 'Short blocked',
			message:
				'Arivuno stopped the Shorts feed. You can go back or open only this clip in YouTube\u2019s regular player.',
			watchUrl: buildRegularWatchUrl(target.videoId),
		};
	}

	return {
		eyebrow: 'YouTube Shorts',
		title: 'Shorts feed blocked',
		message:
			'Arivuno stopped the endless Shorts feed before it opened. Head back when you are ready.',
		watchUrl: null,
	};
}
