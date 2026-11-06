import { expect, test, type Page } from '@playwright/test';
import { PASSWORD, gotoReady, logOut, signInAsAdmin, signUp } from './helpers';

const row = (page: Page, email: string) => page.getByRole('listitem').filter({ hasText: email });

test('an admin sees everyone newest first, with how they got in', async ({ page }) => {
	const stamp = Date.now();
	const invited = await signUp(page, `invited-${stamp}@test.dev`);
	await logOut(page);

	const colleague = `colleague-${stamp}@company.test`;
	await gotoReady(page, '/signup');
	await page.getByLabel('Email').fill(colleague);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	await logOut(page);

	await signInAsAdmin(page, 'admin-5@e2e.test');
	await page.getByRole('link', { name: 'Users' }).click();
	await expect(page).toHaveURL('/users');
	await expect(page).toHaveTitle('Users · Butterfly Net');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Users');

	await expect(row(page, invited)).toContainText('Invite from inviter@e2e.test');
	await expect(row(page, colleague)).toContainText('Company email');
	await expect(row(page, 'admin-5@e2e.test')).toContainText('Admin');
	await expect(row(page, colleague)).not.toContainText('Admin');

	// Newest first: the colleague signed up after the invited user.
	const emails = await page.getByRole('listitem').allTextContents();
	const at = (email: string) => emails.findIndex((text) => text.includes(email));
	expect(at(colleague)).toBeLessThan(at(invited));

	// The total matches the rows shown.
	const count = await page.getByRole('listitem').count();
	await expect(page.getByText(`${count} people have signed up`)).toBeVisible();
});

test('other users get a 404 and see no Users link', async ({ page }) => {
	await signUp(page);
	await expect(page.getByRole('link', { name: 'Users' })).toHaveCount(0);
	const response = await page.goto('/users');
	expect(response?.status()).toBe(404);
});

test('a signed-out visitor is sent to log in', async ({ page }) => {
	await gotoReady(page, '/users');
	await expect(page).toHaveURL('/login?next=%2Fusers');
});

test('with 200% text on a 320px phone the list fits without sideways scrolling', async ({
	page
}) => {
	await page.setViewportSize({ width: 320, height: 640 });
	await signInAsAdmin(page, 'admin-6@e2e.test');
	await gotoReady(page, '/users');
	await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
});
