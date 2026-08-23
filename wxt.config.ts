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
			'Remove YouTube Shorts entry points and redirect recognized Shorts pages to a local block screen.',
		minimum_chrome_version: '105',
		permissions: ['storage', 'scripting'],
		host_permissions: [],
		action: {
			default_title: 'Manage Arivuno',
		},
		web_accessible_resources: [
			{
				resources: ['blocked.html'],
				matches: ['https://www.youtube.com/*'],
				use_dynamic_url: true,
			},
		],
	},
});
