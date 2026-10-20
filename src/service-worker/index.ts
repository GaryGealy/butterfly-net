import { self as sw } from '$app/service-worker';

// Makes the app installable. v1 has no offline mode, so this does not intercept fetches.
sw.addEventListener('install', () => {
	sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(sw.clients.claim());
});
