import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'correct horse battery';

export async function signUp(page: Page): Promise<string> {
	const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.dev`;
	await page.goto('/signup');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	return email;
}
