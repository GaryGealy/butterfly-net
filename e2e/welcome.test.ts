import { expect, test, type Page } from '@playwright/test';
import { PASSWORD, createInviteCode, gotoReady, signUp } from './helpers';

const caption = (page: Page) => page.locator('[data-caption]');
const watch = (page: Page) => page.getByRole('button', { name: 'Watch the demo' }).click();
const nextButton = (page: Page) => page.getByRole('button', { name: 'Next' });
const fillOf = (page: Page, name: string) =>
	page.getByRole('button', { name }).locator('[data-fill]');

test('an invite link opens the intro, and Skip reaches sign-up with the invite', async ({
	page
}) => {
	const code = createInviteCode();
	await gotoReady(page, `/welcome?invite=${code}`);
	await expect(page).toHaveTitle('Welcome · Butterfly Net');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText("Here's Butterfly Net");

	await page.getByRole('link', { name: 'Skip to sign-up' }).click();
	await expect(page).toHaveURL(`/signup?invite=${code}`);
	await expect(page.getByRole('heading', { name: 'Create your account' })).toBeVisible();
});

test('the intro waits for a choice: nothing plays until Watch the demo', async ({ page }) => {
	await gotoReady(page, `/welcome?invite=${createInviteCode()}`);
	await expect(page.getByRole('heading', { name: 'New to Butterfly Net?' })).toBeVisible();
	await expect(caption(page)).toHaveCount(0);
	await expect(nextButton(page)).toHaveCount(0);
	await page.waitForTimeout(600);
	await expect(page.getByRole('heading', { name: 'New to Butterfly Net?' })).toBeVisible();

	await watch(page);
	await expect(page.getByRole('heading', { name: 'New to Butterfly Net?' })).toHaveCount(0);
	await expect(nextButton(page)).toBeFocused();
	await expect(caption(page)).toContainText('Catch it before it flutters off');
	await expect(fillOf(page, 'Scene 1: Catch a thought')).not.toHaveAttribute('data-fill', '0.000');
});

test("the card's Go straight to sign-up reaches the form with the invite", async ({ page }) => {
	const code = createInviteCode();
	await gotoReady(page, `/welcome?invite=${code}`);
	await page.getByRole('link', { name: 'Go straight to sign-up' }).click();
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

test('each scene plays once, then waits for Next', async ({ page }) => {
	// The animation steps frame by frame, so this runs in real time: scenes 1 and 3, about 13 s.
	test.slow();
	await gotoReady(page, `/welcome?invite=${createInviteCode()}`);
	await watch(page);

	const scene1 = fillOf(page, 'Scene 1: Catch a thought');
	await expect(scene1).toHaveAttribute('data-fill', '1.000', { timeout: 10_000 });
	await page.waitForTimeout(500);
	await expect(caption(page)).toContainText('Catch it before it flutters off');
	await expect(fillOf(page, 'Scene 2: AI sorts it')).toHaveAttribute('data-fill', '0.000');

	await nextButton(page).click();
	await expect(caption(page)).toContainText('AI suggests a pile');
	await page.getByRole('button', { name: 'Scene 3: Piles and ageing' }).click();
	await expect(caption(page)).toContainText("come back when you're ready", { timeout: 15_000 });
	await expect(nextButton(page)).toHaveCount(0);

	await page.getByRole('button', { name: 'Watch again' }).click();
	await expect(caption(page)).toContainText('Catch it before it flutters off');
	await expect(nextButton(page)).toBeFocused();
});

test('Next skips ahead mid-scene, and a scene can be picked', async ({ page }) => {
	await gotoReady(page, `/welcome?invite=${createInviteCode()}`);
	await watch(page);
	await nextButton(page).click();
	await expect(caption(page)).toContainText('AI suggests a pile');
	await page.getByRole('button', { name: 'Scene 3: Piles and ageing' }).click();
	await expect(caption(page)).toContainText('yellows like old paper');
	await page.getByRole('button', { name: 'Scene 1: Catch a thought' }).click();
	await expect(caption(page)).toContainText('Catch it before it flutters off');
});

test('hiding the tab pauses the demo and coming back resumes it', async ({ page }) => {
	await page.clock.install();
	await gotoReady(page, `/welcome?invite=${createInviteCode()}`);
	await watch(page);
	await page.clock.runFor(1_000);
	const setHidden = (hidden: boolean) =>
		page.evaluate((h) => {
			Object.defineProperty(document, 'hidden', { value: h, configurable: true });
			document.dispatchEvent(new Event('visibilitychange'));
		}, hidden);
	const fill = fillOf(page, 'Scene 1: Catch a thought');
	await setHidden(true);
	const before = await fill.getAttribute('data-fill');
	await page.clock.runFor(2_000);
	await expect(fill).toHaveAttribute('data-fill', before!);
	await setHidden(false);
	await page.clock.runFor(1_000);
	await expect(fill).not.toHaveAttribute('data-fill', before!);
});

test('with reduced motion nothing plays and the scenes switch by hand', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await gotoReady(page, `/welcome?invite=${createInviteCode()}`);
	await watch(page);
	await expect(nextButton(page)).toBeFocused();
	const scene2 = page.getByRole('button', { name: 'Scene 2: AI sorts it' });
	await expect(caption(page)).toContainText('Catch it before it flutters off');
	await nextButton(page).click();
	await expect(scene2).toHaveAttribute('aria-pressed', 'true');
	await expect(caption(page)).toContainText('AI suggests a pile');
	await page.getByRole('button', { name: 'Scene 3: Piles and ageing' }).click();
	await expect(caption(page)).toContainText('yellows like old paper');
	await scene2.click();
	await page.waitForTimeout(500);
	await expect(page.locator('main')).not.toContainText('Claude');
	await expect(caption(page)).toContainText('AI suggests a pile');
});

test('with 200% text on a 320px phone the intro fits without sideways scrolling', async ({
	page
}) => {
	await page.setViewportSize({ width: 320, height: 800 });
	await gotoReady(page, `/welcome?invite=${createInviteCode()}`);
	await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
	const overflow = () =>
		page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
	expect(await overflow()).toBe(0);
	// The card may sit below the fold at this size, but it must never be cut off.
	for (const control of [
		page.getByRole('button', { name: 'Watch the demo' }),
		page.getByRole('link', { name: 'Go straight to sign-up' })
	]) {
		await control.scrollIntoViewIfNeeded();
		await expect(control).toBeInViewport({ ratio: 1 });
	}
	await watch(page);
	expect(await overflow()).toBe(0);
	// Next wraps below the progress segments rather than squeezing them away.
	const segment = await page
		.getByRole('button', { name: 'Scene 1: Catch a thought' })
		.boundingBox();
	expect(segment!.width).toBeGreaterThan(40);
	await expect(page.getByRole('link', { name: 'Create my account' })).toBeVisible();
});
