import './style.css';
import {
	buildBlockedPageUrl,
	parseShortsTarget,
} from '../../src/youtube/shorts-url';
import {checkNavigationAfterCommit} from '../../src/youtube/committed-navigation';

export default defineContentScript({
	matches: ['https://www.youtube.com/*'],
	runAt: 'document_start',
	allFrames: false,
	registration: 'manifest',
	noScriptStartedPostMessage: true,

	main(ctx) {
		const interrupt = (
			input: string | URL,
			historyMode: 'assign' | 'replace',
		): boolean => {
			const target = parseShortsTarget(input);

			if (target === null) {
				return false;
			}

			const blockedUrl = buildBlockedPageUrl(
				browser.runtime.getURL('/blocked.html'),
				target,
			);

			window.stop();

			if (historyMode === 'assign') {
				window.location.assign(blockedUrl);
			} else {
				window.location.replace(blockedUrl);
			}

			return true;
		};

		if (interrupt(window.location.href, 'replace')) {
			return;
		}

		ctx.addEventListener(
			document,
			'click',
			(event) => {
				if (
					event.defaultPrevented ||
					event.button !== 0 ||
					event.altKey ||
					event.ctrlKey ||
					event.metaKey ||
					event.shiftKey
				) {
					return;
				}

				const anchor = findAnchor(event);

				if (
					anchor === null ||
					anchor.target === '_blank' ||
					anchor.hasAttribute('download') ||
					parseShortsTarget(anchor.href) === null
				) {
					return;
				}

				event.preventDefault();
				event.stopImmediatePropagation();
				interrupt(anchor.href, 'assign');
			},
			{capture: true},
		);

		ctx.addEventListener(window, 'wxt:locationchange', ({newUrl}) => {
			checkNavigationAfterCommit({
				expectedUrl: newUrl,
				getCurrentUrl: () => window.location.href,
				schedule: (callback) => {
					ctx.setTimeout(callback, 0);
				},
				onCommitted: (url) => {
					interrupt(url, 'replace');
				},
			});
		});

		ctx.addEventListener(window, 'popstate', () => {
			interrupt(window.location.href, 'replace');
		});
	},
});

function findAnchor(event: MouseEvent): HTMLAnchorElement | null {
	for (const node of event.composedPath()) {
		if (node instanceof HTMLAnchorElement) {
			return node;
		}

		if (node instanceof Element) {
			const anchor = node.closest<HTMLAnchorElement>('a[href]');

			if (anchor !== null) {
				return anchor;
			}
		}
	}

	return null;
}
