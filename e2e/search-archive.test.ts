import { expect, test, type Page } from '@playwright/test';
import { capture, gotoReady, signUp } from './helpers';

test.beforeEach(async ({ page }) => {
	await signUp(page);
	await capture(page, 'Plant tomatoes by the fence');
	await capture(page, 'Paint the Millennium Falcon');
});

async function search(page: Page, q: string) {
	await gotoReady(page, '/search');
	await page.getByLabel('Search your cards').fill(q);
	await page.getByRole('button', { name: 'Search' }).click();
}

async function markDone(page: Page, title: string) {
	await gotoReady(page, '/');
	await page.getByRole('button', { name: `Mark "${title}" done` }).click();
	// Wait for the action to settle (the Undo toast) before navigating away.
	await expect(page.getByRole('status').filter({ hasText: `Done: ${title}` })).toBeVisible();
}

test('finds cards by word prefix', async ({ page }) => {
	await search(page, 'tomato');
	await expect(page.getByRole('link', { name: 'Plant tomatoes by the fence' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Paint the Millennium Falcon' })).toHaveCount(0);
});

test('finds archived cards and labels them', async ({ page }) => {
	await markDone(page, 'Paint the Millennium Falcon');
	await search(page, 'falcon');
	const result = page.getByRole('listitem').filter({ hasText: 'Paint the Millennium Falcon' });
	await expect(result).toContainText('Archived');
});

test('odd search text shows no results instead of an error', async ({ page }) => {
	await search(page, '"( NEAR *');
	await expect(page.getByText('No cards match.')).toBeVisible();
});

test('the archive lists done cards and can reopen them', async ({ page }) => {
	await gotoReady(page, '/archive');
	await expect(page.getByText('Nothing archived yet.')).toBeVisible();

	await markDone(page, 'Plant tomatoes by the fence');
	await gotoReady(page, '/archive');
	const item = page.getByRole('listitem').filter({ hasText: 'Plant tomatoes by the fence' });
	await expect(item).toContainText('garden');
	const reopened = page.waitForResponse((r) => r.url().includes('?/reopen'));
	await item.getByRole('button', { name: 'Reopen' }).click();
	await reopened;
	await expect(page.getByText('Nothing archived yet.')).toBeVisible();

	await gotoReady(page, '/');
	await expect(page.getByRole('region', { name: 'garden' })).toContainText(
		'Plant tomatoes by the fence'
	);
});

test('a search longer than 200 characters is cut to 200', async ({ page }) => {
	await gotoReady(page, `/search?q=tomato${'x'.repeat(300)}`);
	const input = page.getByLabel('Search your cards');
	await expect(input).toHaveValue(`tomato${'x'.repeat(194)}`);
	await expect(page.getByText('No cards match.')).toBeVisible();
});
