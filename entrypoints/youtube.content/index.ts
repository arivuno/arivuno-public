import './style.css';
import {
	buildBlockedPageUrl,
	parseShortsTarget,
} from '../../src/youtube/shorts-url';
import {checkNavigationAfterCommit} from '../../src/youtube/committed-navigation';
import {
	ACTIVATION_DOCUMENT_ATTRIBUTE,
	ACTIVATION_STORAGE_KEY,
	isEnabledActivationState,
} from '../../src/activation/state';

export default defineContentScript({
	matches: ['https://www.youtube.com/*'],
	runAt: 'document_start',
	allFrames: false,
	registration: 'runtime',
	noScriptStartedPostMessage: true,

	async main(ctx) {
		let activated = false;
		let activationChangedDuringRead = false;
		const stop = (): void => {
			browser.storage.onChanged.removeListener(onStorageChanged);

			if (activated) {
				document.documentElement.removeAttribute(ACTIVATION_DOCUMENT_ATTRIBUTE);
			}

			ctx.abort();
		};
		const onStorageChanged = (
			changes: Record<string, Browser.storage.StorageChange>,
			areaName: string,
		): void => {
			const change = changes[ACTIVATION_STORAGE_KEY];

			if (areaName !== 'local' || change === undefined) {
				return;
			}

			if (!activated) {
				activationChangedDuringRead = true;
				return;
			}

			if (!isEnabledActivationState(change.newValue)) {
				stop();
			}
		};

		browser.storage.onChanged.addListener(onStorageChanged);
		ctx.onInvalidated(() => {
			browser.storage.onChanged.removeListener(onStorageChanged);
		});

		try {
			const result = await browser.storage.local.get(ACTIVATION_STORAGE_KEY);

			if (
				ctx.isInvalid ||
				activationChangedDuringRead ||
				!isEnabledActivationState(result[ACTIVATION_STORAGE_KEY])
			) {
				stop();
				return;
			}
		} catch {
			stop();
			return;
		}

		activated = true;
		document.documentElement.setAttribute(ACTIVATION_DOCUMENT_ATTRIBUTE, '');

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
