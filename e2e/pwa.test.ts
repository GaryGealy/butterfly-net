import { expect, test } from '@playwright/test';
import { gotoReady } from './helpers';

test('the manifest is linked and served without signing in', async ({ page, request }) => {
	await gotoReady(page, '/login');
	await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
		'href',
		'/manifest.webmanifest'
	);

	const response = await request.get('/manifest.webmanifest');
	expect(response.ok()).toBe(true);
	const manifest = await response.json();
	expect(manifest).toMatchObject({ name: 'Butterfly Net', start_url: '/', display: 'standalone' });
	expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(
		expect.arrayContaining(['192x192', '512x512'])
	);
	expect((await request.get('/icons/icon-192.png')).ok()).toBe(true);
});
