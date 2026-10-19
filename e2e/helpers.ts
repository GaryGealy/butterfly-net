import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'correct horse battery';

export async function signUp(page: Page): Promise<string> {
	const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.dev`;
	await gotoReady(page, '/signup');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	await waitForHydration(page);
	return email;
}

export async function waitForHydration(page: Page): Promise<void> {
	await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

export async function gotoReady(page: Page, url: string): Promise<void> {
	await page.goto(url);
	await waitForHydration(page);
}

export async function logOut(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'Log out' }).click();
	await expect(page).toHaveURL('/login');
	await waitForHydration(page);
}

export async function capture(page: Page, text: string, pile?: string): Promise<void> {
	await page.getByLabel('Catch a thought').fill(text);
	await page.getByRole('button', { name: 'Catch' }).click();
	const preview = page.getByRole('form', { name: 'Card preview' });
	await expect(preview).toBeVisible();
	if (pile) await preview.getByLabel('Pile').selectOption({ label: pile });
	await preview.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Caught ✓' })).toBeVisible();
}
