import { expect, test } from '@playwright/test';
import { PASSWORD, gotoReady, logOut, signInAsAdmin, signUp, waitForHydration } from './helpers';

test('the admin creates an invite link and someone joins with it', async ({ page }) => {
	await signInAsAdmin(page, 'admin-1@e2e.test');
	await page.getByRole('link', { name: 'Invites' }).click();
	await waitForHydration(page);
	await page.getByRole('button', { name: 'Create invite link' }).click();
	const link = page.getByLabel('New invite link');
	await expect(link).toHaveValue(/\/signup\?invite=[A-Za-z0-9_-]{22}$/);
	const url = new URL(await link.inputValue());
	await logOut(page);

	const joiner = `joiner-${Date.now()}@test.dev`;
	await gotoReady(page, url.pathname + url.search);
	await page.getByLabel('Email').fill(joiner);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	await logOut(page);

	await signInAsAdmin(page, 'admin-1@e2e.test');
	await gotoReady(page, '/invites');
	await expect(page.getByRole('region', { name: 'Used', exact: true })).toContainText(joiner);
});

test('the admin can revoke an unused link', async ({ page }) => {
	await signInAsAdmin(page, 'admin-2@e2e.test');
	await gotoReady(page, '/invites');
	await page.getByRole('button', { name: 'Create invite link' }).click();
	const code = new URL(await page.getByLabel('New invite link').inputValue()).searchParams.get(
		'invite'
	)!;
	const unused = page.getByRole('region', { name: 'Unused', exact: true });
	await unused
		.getByRole('listitem')
		.filter({ hasText: code })
		.getByRole('button', { name: 'Revoke' })
		.click();
	await expect(unused).not.toContainText(code);

	await logOut(page);
	await gotoReady(page, `/signup?invite=${code}`);
	await expect(page.getByText('Butterfly Net is invite-only right now.')).toBeVisible();
});

test('other users get a 404 and see no Invites link', async ({ page }) => {
	await signUp(page);
	await expect(page.getByRole('link', { name: 'Invites' })).toHaveCount(0);
	const response = await page.goto('/invites');
	expect(response?.status()).toBe(404);
	const action = await page.request.post('/invites?/create', {
		form: {},
		headers: { origin: new URL(page.url()).origin }
	});
	expect(action.status()).toBe(404);
});
