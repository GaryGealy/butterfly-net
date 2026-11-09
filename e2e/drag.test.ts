import { expect, test, type Page } from '@playwright/test';
import { capture, signUp, waitForHydration } from './helpers';

const pile = (page: Page, name: string) => page.getByRole('region', { name, exact: true });
const moved = (page: Page) => page.getByRole('status').filter({ hasText: 'Moved to' });

async function drag(page: Page, title: string, to: string) {
	await page.getByRole('listitem').filter({ hasText: title }).dragTo(pile(page, to));
}

test('drag a card onto another pile, and it stays there', async ({ page }) => {
	await signUp(page);
	await capture(page, 'Fix the gate latch', 'house');

	await drag(page, 'Fix the gate latch', 'ideas');
	await expect(pile(page, 'ideas').getByRole('link', { name: 'Fix the gate latch' })).toBeVisible();
	await expect(pile(page, 'house').getByRole('link', { name: 'Fix the gate latch' })).toHaveCount(
		0
	);
	await expect(moved(page)).toContainText('Moved to ideas');

	await page.reload();
	await waitForHydration(page);
	await expect(pile(page, 'ideas').getByRole('link', { name: 'Fix the gate latch' })).toBeVisible();
});

test('Undo puts a moved card back', async ({ page }) => {
	await signUp(page);
	await capture(page, 'Fix the gate latch', 'house');

	await drag(page, 'Fix the gate latch', 'ideas');
	await moved(page).getByRole('button', { name: 'Undo' }).click();
	await expect(pile(page, 'house').getByRole('link', { name: 'Fix the gate latch' })).toBeVisible();

	await page.reload();
	await waitForHydration(page);
	await expect(pile(page, 'house').getByRole('link', { name: 'Fix the gate latch' })).toBeVisible();
	await expect(pile(page, 'ideas').getByRole('link', { name: 'Fix the gate latch' })).toHaveCount(
		0
	);
});

test('a failed move puts the card back and says so', async ({ page }) => {
	await signUp(page);
	await capture(page, 'Fix the gate latch', 'house');
	await page.route(
		(url) => url.search === '?/move',
		(route) => route.abort()
	);

	await drag(page, 'Fix the gate latch', 'ideas');
	await expect(page.getByRole('alert')).toHaveText(
		'Couldn’t move “Fix the gate latch”. Try again.'
	);
	await expect(pile(page, 'house').getByRole('link', { name: 'Fix the gate latch' })).toBeVisible();
	await expect(pile(page, 'ideas').getByRole('link', { name: 'Fix the gate latch' })).toHaveCount(
		0
	);
});

test('dropping a card back on its own pile does nothing', async ({ page }) => {
	await signUp(page);
	await capture(page, 'Fix the gate latch', 'house');
	let posted = false;
	page.on('request', (r) => {
		if (r.method() === 'POST' && r.url().includes('/move')) posted = true;
	});

	await drag(page, 'Fix the gate latch', 'house');
	await expect(pile(page, 'house').getByRole('link', { name: 'Fix the gate latch' })).toBeVisible();
	await expect(moved(page)).toHaveCount(0);
	expect(posted).toBe(false);
});
