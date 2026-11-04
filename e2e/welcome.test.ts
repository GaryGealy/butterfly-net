import { expect, test, type Page } from '@playwright/test';
import { PASSWORD, createInviteCode, gotoReady, signUp } from './helpers';

const caption = (page: Page) => page.locator('[data-caption]');

test('an invite link opens the intro, and Skip reaches sign-up with the invite', async ({
	page
}) => {
	const code = createInviteCode();
	await gotoReady(page, `/welcome?invite=${code}`);
	await expect(page).toHaveTitle('Welcome · Butterfly Net');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText("Here's Butterfly Net");
	await expect(caption(page)).toContainText('Catch it before it flutters off');

	await page.getByRole('link', { name: 'Skip to sign-up' }).click();
	await expect(page).toHaveURL(`/signup?invite=${code}`);
	await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
});

test('Create my account reaches sign-up and the account is made', async ({ page }) => {
	const code = createInviteCode();
	await gotoReady(page, `/welcome?invite=${code}`);
	await page.getByRole('link', { name: 'Create my account' }).click();
	await expect(page).toHaveURL(`/signup?invite=${code}`);
	await page.getByLabel('Email').fill(`welcome-${Date.now()}@test.dev`);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
});

test('a missing or used invite goes straight to the sign-up page', async ({ page }) => {
	await gotoReady(page, '/welcome');
	await expect(page).toHaveURL('/signup');
	await expect(page.getByText('Butterfly Net is invite-only right now.')).toBeVisible();

	await gotoReady(page, '/welcome?invite=not-a-real-code');
	await expect(page).toHaveURL('/signup?invite=not-a-real-code');
	await expect(page.getByText('Butterfly Net is invite-only right now.')).toBeVisible();
});

test('a bogus code with odd characters arrives at sign-up intact', async ({ page }) => {
	await gotoReady(page, `/welcome?invite=${encodeURIComponent('a&b+c d')}`);
	expect(new URL(page.url()).searchParams.get('invite')).toBe('a&b+c d');
	await expect(page.getByText('Butterfly Net is invite-only right now.')).toBeVisible();
});

test('someone already signed in goes to their piles', async ({ page }) => {
	await signUp(page);
	await gotoReady(page, `/welcome?invite=${createInviteCode()}`);
	await expect(page).toHaveURL('/');
});

test('old sign-up links still work without the intro', async ({ page }) => {
	await gotoReady(page, `/signup?invite=${createInviteCode()}`);
	await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
});

test('pause holds the demo still, and a scene can be picked', async ({ page }) => {
	await gotoReady(page, `/welcome?invite=${createInviteCode()}`);
	await page.getByRole('button', { name: 'Pause' }).click();
	const fill = page
		.getByRole('button', { name: 'Scene 1: Catch a thought' })
		.locator('[data-fill]');
	const before = await fill.getAttribute('data-fill');
	await page.waitForTimeout(600);
	expect(await fill.getAttribute('data-fill')).toBe(before);
	await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();

	await page.getByRole('button', { name: 'Scene 3: Piles and ageing' }).click();
	await expect(caption(page)).toContainText('yellows like old paper');
});

test('hiding the tab pauses the demo and coming back resumes it', async ({ page }) => {
	await gotoReady(page, `/welcome?invite=${createInviteCode()}`);
	const setHidden = (hidden: boolean) =>
		page.evaluate((h) => {
			Object.defineProperty(document, 'hidden', { value: h, configurable: true });
			document.dispatchEvent(new Event('visibilitychange'));
		}, hidden);
	await setHidden(true);
	await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
	await setHidden(false);
	await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
});

test('with reduced motion nothing plays and the scenes switch by hand', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await gotoReady(page, `/welcome?invite=${createInviteCode()}`);
	await expect(page.getByRole('button', { name: 'Pause' })).toHaveCount(0);
	const scene2 = page.getByRole('button', { name: 'Scene 2: Claude sorts it' });
	await expect(caption(page)).toContainText('Catch it before it flutters off');
	await scene2.click();
	await expect(scene2).toHaveAttribute('aria-pressed', 'true');
	await expect(caption(page)).toContainText('Claude suggests a pile');
	await page.waitForTimeout(500);
	await expect(caption(page)).toContainText('Claude suggests a pile');
});

test('with 200% text on a 320px phone the intro fits without sideways scrolling', async ({
	page
}) => {
	await page.setViewportSize({ width: 320, height: 800 });
	await gotoReady(page, `/welcome?invite=${createInviteCode()}`);
	await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBe(0);
	await expect(page.getByRole('link', { name: 'Create my account' })).toBeVisible();
});
