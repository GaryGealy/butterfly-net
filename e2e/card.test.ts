import { expect, test } from '@playwright/test';
import { capture, signUp, waitForHydration } from './helpers';

test('edit a card: title, notes, pile, and subtasks', async ({ page }) => {
	await signUp(page);
	await capture(page, 'Build the TIE fighter kit');
	await page.getByRole('link', { name: 'Build the TIE fighter kit' }).click();
	await waitForHydration(page);

	await page.getByLabel('Title').fill('Build the TIE interceptor kit');
	await page.getByLabel('Notes').fill('Bandai 1/72');
	await page.getByRole('button', { name: 'Add subtask' }).click();
	await page.getByLabel('Subtask 1', { exact: true }).fill('Prime the parts');
	await page.getByRole('button', { name: 'Add subtask' }).click();
	await page.getByLabel('Subtask 2', { exact: true }).fill('Paint the panels');
	await page.getByLabel('Subtask 1 done').check();
	await page.getByLabel('Pile').selectOption({ label: 'ideas' });
	await page.getByRole('button', { name: 'Save changes' }).click();
	await expect(page.getByRole('status')).toHaveText('Saved');

	await page.reload();
	await waitForHydration(page);
	await expect(page.getByLabel('Title')).toHaveValue('Build the TIE interceptor kit');
	await expect(page.getByLabel('Notes')).toHaveValue('Bandai 1/72');
	await expect(page.getByLabel('Subtask 1', { exact: true })).toHaveValue('Prime the parts');
	await expect(page.getByLabel('Subtask 1 done')).toBeChecked();
	await expect(page.getByLabel('Subtask 2 done')).not.toBeChecked();
	await expect(page.getByLabel('Pile').locator('option:checked')).toHaveText('ideas');
});

test('mark done, reopen, and delete from the card page', async ({ page }) => {
	await signUp(page);
	await capture(page, 'Paint the AT-AT');
	await page.getByRole('link', { name: 'Paint the AT-AT' }).click();
	await waitForHydration(page);

	await page.getByRole('button', { name: 'Mark done' }).click();
	await expect(page.getByRole('button', { name: 'Reopen' })).toBeVisible();
	await page.getByRole('button', { name: 'Reopen' }).click();
	await expect(page.getByRole('button', { name: 'Mark done' })).toBeVisible();

	await page.getByRole('button', { name: 'Delete card' }).click();
	await page.getByRole('button', { name: 'Yes, delete it' }).click();
	await expect(page).toHaveURL('/');
	await expect(page.getByRole('link', { name: 'Paint the AT-AT' })).toHaveCount(0);
});

test("another user's card is not found", async ({ page, browser }) => {
	await signUp(page);
	await capture(page, 'Paint the secret kit');
	await page.getByRole('link', { name: 'Paint the secret kit' }).click();
	await expect(page).toHaveURL(/\/card\/[^/]+$/);
	const cardUrl = page.url();

	const otherContext = await browser.newContext();
	const other = await otherContext.newPage();
	await signUp(other);
	const response = await other.goto(cardUrl);
	expect(response?.status()).toBe(404);
	await otherContext.close();
});
