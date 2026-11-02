import { expect, test } from '@playwright/test';
import { PASSWORD, createInviteCode, gotoReady, logOut, signUp } from './helpers';

test('signing up lands on the piles page', async ({ page }) => {
	await signUp(page);
	await expect(page.getByRole('link', { name: 'Manage piles' })).toBeVisible();
});

test('the header shows which account is signed in', async ({ page }) => {
	const email = await signUp(page);
	await expect(page.getByRole('banner').getByText(`Signed in as ${email}`)).toBeVisible();

	await logOut(page);
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Log in' }).click();
	await expect(page).toHaveURL('/');
	await expect(page.getByRole('banner').getByText(`Signed in as ${email}`)).toBeVisible();
});

test('a signed-out visitor is sent to log in, then back where they were going', async ({
	page
}) => {
	const email = await signUp(page);
	await logOut(page);

	await gotoReady(page, '/search?q=paint');
	await expect(page).toHaveURL(/\/login\?next=%2Fsearch%3Fq%3Dpaint/);
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Log in' }).click();
	await expect(page).toHaveURL('/search?q=paint');
});

test('a wrong password shows an error', async ({ page }) => {
	const email = await signUp(page);
	await logOut(page);
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill('not the password');
	await page.getByRole('button', { name: 'Log in' }).click();
	await expect(page.getByRole('alert')).toHaveText('Wrong email or password');
});

const INVITE_ONLY = 'Butterfly Net is invite-only right now.';

test('sign-up without a usable invite shows the invite-only message', async ({ page }) => {
	for (const url of ['/signup', '/signup?invite=not-a-real-code']) {
		await gotoReady(page, url);
		await expect(page.getByText(INVITE_ONLY)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Create account' })).toHaveCount(0);
	}
});

test('an invite link works once', async ({ page }) => {
	const code = createInviteCode();
	await gotoReady(page, `/signup?invite=${code}`);
	await page.getByLabel('Email').fill(`once-${Date.now()}@test.dev`);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	await logOut(page);

	await gotoReady(page, `/signup?invite=${code}`);
	await expect(page.getByText(INVITE_ONLY)).toBeVisible();
});

test('a taken email is refused and the invite link still works', async ({ page }) => {
	const email = await signUp(page);
	await logOut(page);

	const code = createInviteCode();
	await gotoReady(page, `/signup?invite=${code}`);
	await page.getByLabel('Email').fill(email.toUpperCase());
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page.getByRole('alert')).toHaveText('An account with that email already exists');

	await page.getByLabel('Email').fill(`second-${Date.now()}@test.dev`);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
});

test('the log-in page no longer offers sign-up', async ({ page }) => {
	await gotoReady(page, '/login');
	await expect(page.getByRole('link', { name: 'Create an account' })).toHaveCount(0);
});

test('the parse API refuses captures over 1000 characters', async ({ page }) => {
	await signUp(page);
	const response = await page.request.post('/api/parse', { data: { text: 'x'.repeat(1001) } });
	expect(response.status()).toBe(400);
});

test('the API refuses signed-out requests', async ({ request }) => {
	const response = await request.post('/api/parse', { data: { text: 'hello' } });
	expect(response.status()).toBe(401);
});
