export interface DeferredNavigationCheck {
	expectedUrl: URL;
	getCurrentUrl: () => string;
	schedule: (callback: () => void) => void;
	onCommitted: (url: string) => void;
}

/**
 * WXT's location-change event can fire before a Navigation API transition
 * commits. Waiting for the next task prevents us from replacing the page the
 * user is leaving. The equality check also ignores cancelled or superseded
 * transitions.
 */
export function checkNavigationAfterCommit({
	expectedUrl,
	getCurrentUrl,
	schedule,
	onCommitted,
}: DeferredNavigationCheck): void {
	schedule(() => {
		const currentUrl = getCurrentUrl();

		if (currentUrl === expectedUrl.href) {
			onCommitted(currentUrl);
		}
	});
}
