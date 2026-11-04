import { expect, test } from '@playwright/test';
import { capture, gotoReady, signInAsAdmin, signUp, waitForHydration } from './helpers';

test('every page has a top-level heading', async ({ page }) => {
	await signUp(page);
	await capture(page, 'Oil the garden gate', 'house');
	await expect(page.getByRole('heading', { level: 1, name: 'Your piles' })).toBeAttached();

	await page.getByRole('link', { name: 'Oil the garden gate' }).click();
	await waitForHydration(page);
	await expect(page.getByRole('heading', { level: 1, name: 'Oil the garden gate' })).toBeAttached();

	await gotoReady(page, '/quick-add');
	await expect(page.getByRole('heading', { level: 1, name: 'Butterfly Net' })).toBeVisible();
});

test('marking a card done moves focus to the next card, and Undo brings it back', async ({
	page
}) => {
	await signUp(page);
	await capture(page, 'Sweep the porch', 'house');
	await capture(page, 'Clean the gutters', 'house');

	const first = page.getByRole('button', { name: 'Mark "Sweep the porch" done' });
	const second = page.getByRole('button', { name: 'Mark "Clean the gutters" done' });
	await first.focus();
	await page.keyboard.press('Enter');
	await expect(first).toHaveCount(0);
	await expect(second).toBeFocused();

	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(page.getByRole('button', { name: 'Mark "Sweep the porch" done' })).toBeFocused();
});

test('the last card on a pile hands focus to the pile', async ({ page }) => {
	await signUp(page);
	await capture(page, 'Book a dentist visit', 'ideas');
	await page.getByRole('button', { name: 'Mark "Book a dentist visit" done' }).focus();
	await page.keyboard.press('Enter');
	await expect(page.getByRole('region', { name: 'ideas' })).toBeFocused();
});

test('card page buttons that swap keep focus', async ({ page }) => {
	await signUp(page);
	await capture(page, 'Fix the fence');
	await page.getByRole('link', { name: 'Fix the fence' }).click();
	await waitForHydration(page);

	await page.getByRole('button', { name: 'Mark done' }).focus();
	await page.keyboard.press('Enter');
	await expect(page.getByRole('button', { name: 'Reopen' })).toBeFocused();

	await page.getByRole('button', { name: 'Delete card' }).focus();
	await page.keyboard.press('Enter');
	await expect(page.getByRole('button', { name: 'Keep it' })).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page.getByRole('button', { name: 'Delete card' })).toBeFocused();
});

test('reopening from the archive moves focus to the next archived card', async ({ page }) => {
	await signUp(page);
	await capture(page, 'Paint the shed');
	await capture(page, 'Wash the car');
	await page.getByRole('button', { name: 'Mark "Paint the shed" done' }).click();
	await expect(page.getByRole('button', { name: 'Mark "Paint the shed" done' })).toHaveCount(0);
	await page.getByRole('button', { name: 'Mark "Wash the car" done' }).click();
	await expect(page.getByRole('button', { name: 'Mark "Wash the car" done' })).toHaveCount(0);

	await gotoReady(page, '/archive');
	const reopen = page.getByRole('button', { name: 'Reopen' });
	await reopen.first().focus();
	await page.keyboard.press('Enter');
	await expect(reopen).toHaveCount(1);
	await expect(reopen).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page.getByRole('heading', { level: 1, name: 'Archive' })).toBeFocused();
});

test('moving a pile keeps focus on its arrows', async ({ page }) => {
	await signUp(page);
	await gotoReady(page, '/piles');
	await page.getByRole('button', { name: 'Move work stuff up' }).focus();
	await page.keyboard.press('Enter');
	// work stuff is now first, so its up arrow is disabled and focus moves to its down arrow.
	await expect(page.getByRole('button', { name: 'Move work stuff down' })).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page.getByRole('button', { name: 'Move work stuff down' })).toBeFocused();
});

test('when the clipboard is blocked, the invite link is shown selected to copy by hand', async ({
	page
}) => {
	await page.addInitScript(() => {
		navigator.clipboard.writeText = () => Promise.reject(new Error('blocked'));
	});
	await signInAsAdmin(page, 'admin-4@e2e.test');
	await gotoReady(page, '/invites');
	await page.getByRole('button', { name: 'Create invite link' }).click();
	const link = await page.getByLabel('New invite link').inputValue();

	await page.getByRole('button', { name: 'Copy' }).first().click();
	const manual = page.getByLabel(/Couldn't copy it for you/);
	await expect(manual).toBeFocused();
	await expect(manual).toHaveValue(link);
	expect(
		await manual.evaluate((el: HTMLInputElement) =>
			el.value.slice(el.selectionStart!, el.selectionEnd!)
		)
	).toBe(link);
});
