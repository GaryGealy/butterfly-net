import { expect, test } from '@playwright/test';
import { capture, gotoReady, signUp } from './helpers';

test.beforeEach(async ({ page }) => {
	await signUp(page);
});

test('shows the five default piles', async ({ page }) => {
	for (const name of ['house', 'work stuff', 'ideas', 'video games', 'model building']) {
		await expect(page.getByRole('region', { name })).toBeVisible();
	}
});

test("Claude's pile is preselected, and the card lands on it", async ({ page }) => {
	await page.getByLabel('Catch a thought').fill('Paint the X-wing canopy');
	await page.getByRole('button', { name: 'Catch' }).click();
	const preview = page.getByRole('form', { name: 'Card preview' });
	await expect(preview.getByLabel('Title')).toHaveValue('Paint the X-wing canopy');
	await expect(preview.getByLabel('Pile').locator('option:checked')).toHaveText('model building');
	await preview.getByRole('button', { name: 'Save' }).click();

	await expect(page.getByRole('status').filter({ hasText: 'Caught ✓' })).toBeVisible();
	await expect(page.getByRole('region', { name: 'model building' })).toContainText(
		'Paint the X-wing canopy'
	);
});

test('accepting a proposed new pile creates it', async ({ page }) => {
	await page.getByLabel('Catch a thought').fill('Plant tomatoes');
	await page.getByRole('button', { name: 'Catch' }).click();
	const preview = page.getByRole('form', { name: 'Card preview' });
	await expect(preview.getByLabel('Pile').locator('option:checked')).toHaveText(
		'✨ New pile: garden'
	);
	await preview.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('region', { name: 'garden' })).toContainText('Plant tomatoes');
});

test('when Claude is down, the thought is still caught', async ({ page }) => {
	await page.getByLabel('Catch a thought').fill('[fail] Call the plumber');
	await page.getByRole('button', { name: 'Catch' }).click();
	const preview = page.getByRole('form', { name: 'Card preview' });
	await expect(preview.getByRole('status')).toContainText("Couldn't sort this one automatically");
	await expect(preview.getByRole('button', { name: 'Save' })).toBeDisabled();
	await preview.getByLabel('Pile').selectOption({ label: 'house' });
	await preview.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('region', { name: 'house' })).toContainText(
		'[fail] Call the plumber'
	);
});

test('cancel returns to the text without saving', async ({ page }) => {
	await page.getByLabel('Catch a thought').fill('Paint the TIE fighter');
	await page.getByRole('button', { name: 'Catch' }).click();
	await page.getByRole('button', { name: 'Cancel' }).click();
	await expect(page.getByLabel('Catch a thought')).toHaveValue('Paint the TIE fighter');
	await expect(page.getByRole('region', { name: 'model building' })).not.toContainText(
		'TIE fighter'
	);
});

test('marking a card done can be undone', async ({ page }) => {
	await capture(page, 'Paint the Y-wing');
	const pile = page.getByRole('region', { name: 'model building' });
	await pile.getByRole('button', { name: 'Mark "Paint the Y-wing" done' }).click();
	await expect(pile).not.toContainText('Paint the Y-wing');
	await expect(
		page.getByRole('status').filter({ hasText: 'Done: Paint the Y-wing' })
	).toBeVisible();
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(pile).toContainText('Paint the Y-wing');
});

test('pressing n focuses the capture box', async ({ page }) => {
	await page.locator('body').click();
	await page.keyboard.press('n');
	await expect(page.getByLabel('Catch a thought')).toBeFocused();
});

test('quick-add catches a thought and stays ready for the next', async ({ page }) => {
	await gotoReady(page, '/quick-add');
	await expect(page.getByRole('link', { name: 'Manage piles' })).toHaveCount(0);
	await capture(page, 'Beat the next game level');
	await expect(page.getByLabel('Catch a thought')).toHaveValue('');
	await gotoReady(page, '/');
	await expect(page.getByRole('region', { name: 'video games' })).toContainText(
		'Beat the next game level'
	);
});
