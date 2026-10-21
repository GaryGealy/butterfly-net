import { expect, test } from '@playwright/test';
import { signUp } from './helpers';

test('an unknown page shows the friendly not-found page', async ({ page }) => {
	await signUp(page);
	const response = await page.goto('/no-such-page');
	expect(response?.status()).toBe(404);
	await expect(page.getByRole('heading', { name: 'This one flew off' })).toBeVisible();
	await page.getByRole('link', { name: 'Back to your piles' }).click();
	await expect(page).toHaveURL('/');
});
