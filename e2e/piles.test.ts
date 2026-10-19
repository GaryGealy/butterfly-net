import { expect, test, type Page } from '@playwright/test';
import { capture, gotoReady, signUp } from './helpers';

test.beforeEach(async ({ page }) => {
	await signUp(page);
});

const pileNames = (page: Page) =>
	page
		.getByRole('listitem')
		.locator('input[aria-label^="Name for"]')
		.evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));

const renameButton = (page: Page, name: string) =>
	page
		.getByRole('listitem')
		.filter({ has: page.getByLabel(`Name for ${name}`) })
		.getByRole('button', { name: 'Rename' });

test('add, rename, and reorder piles', async ({ page }) => {
	await gotoReady(page, '/piles');
	await page.getByLabel('New pile name').fill('garden');
	await page.getByRole('button', { name: 'Add pile' }).click();
	await expect.poll(() => pileNames(page)).toContain('garden');

	await page.getByLabel('Name for garden').fill('yard');
	await renameButton(page, 'garden').click();
	await expect.poll(() => pileNames(page)).toContain('yard');

	await page.getByRole('button', { name: 'Move work stuff up' }).click();
	await expect
		.poll(async () => (await pileNames(page)).slice(0, 2))
		.toEqual(['work stuff', 'house']);
});

test('renaming onto an existing name is refused', async ({ page }) => {
	await gotoReady(page, '/piles');
	await page.getByLabel('Name for house').fill('IDEAS');
	await renameButton(page, 'house').click();
	await expect(page.getByRole('alert')).toHaveText('A pile named "IDEAS" already exists');
});

test('an empty pile deletes directly', async ({ page }) => {
	await gotoReady(page, '/piles');
	await page.getByRole('button', { name: 'Delete ideas' }).click();
	await expect.poll(() => pileNames(page)).not.toContain('ideas');
});

test('a pile with cards asks where its cards go', async ({ page }) => {
	await capture(page, 'Paint the snowspeeder');
	await gotoReady(page, '/piles');
	await page.getByLabel("Move model building's cards to").selectOption({ label: 'ideas' });
	await page.getByRole('button', { name: 'Delete model building' }).click();
	await expect.poll(() => pileNames(page)).not.toContain('model building');

	await gotoReady(page, '/');
	await expect(page.getByRole('region', { name: 'ideas' })).toContainText('Paint the snowspeeder');
});

test('the last pile cannot be deleted', async ({ page }) => {
	await gotoReady(page, '/piles');
	for (const name of ['work stuff', 'ideas', 'video games', 'model building']) {
		await page.getByRole('button', { name: `Delete ${name}` }).click();
		await expect.poll(() => pileNames(page)).not.toContain(name);
	}
	await expect(page.getByRole('button', { name: 'Delete house' })).toHaveCount(0);
	await expect(page.getByText('your last pile can’t be deleted')).toBeVisible();
});
