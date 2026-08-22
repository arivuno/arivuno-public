import {defineConfig} from 'wxt';

export default defineConfig({
	vite: () => ({
		build: {
			modulePreload: {polyfill: false},
		},
	}),
	manifest: {
		name: 'Arivuno',
		description:
			'Remove YouTube Shorts entry points and interrupt Shorts pages before the feed opens.',
		permissions: [],
		host_permissions: [],
		web_accessible_resources: [
			{
				resources: ['blocked.html'],
				matches: ['https://www.youtube.com/*'],
				use_dynamic_url: true,
			},
		],
	},
});
