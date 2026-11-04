import { expect, test } from '@playwright/test';
import { capture, gotoReady, logOut, seedParseUsage, signInAsAdmin, signUp } from './helpers';

test.beforeEach(async ({ page }) => {
	await signUp(page);
});

test('shows the five default piles', async ({ page }) => {
	for (const name of ['house', 'work stuff', 'ideas', 'video games', 'model building']) {
		await expect(page.getByRole('region', { name })).toBeVisible();
	}
});

test("Claude's pile is preselected, and the card lands on it", async ({ page }) => {
	await page.getByLabel('Catch a thought').fill('Paint the X-wing canopy');
	await page.getByRole('button', { name: 'Catch' }).click();
	const preview = page.getByRole('form', { name: 'Card preview' });
	await expect(preview.getByLabel('Title')).toHaveValue('Paint the X-wing canopy');
	await expect(preview.getByLabel('Pile').locator('option:checked')).toHaveText('model building');
	await preview.getByRole('button', { name: 'Save' }).click();

	await expect(page.getByRole('status').filter({ hasText: 'Caught ✓' })).toBeVisible();
	await expect(page.getByRole('region', { name: 'model building' })).toContainText(
		'Paint the X-wing canopy'
	);
});

test('accepting a proposed new pile creates it', async ({ page }) => {
	await page.getByLabel('Catch a thought').fill('Plant tomatoes');
	await page.getByRole('button', { name: 'Catch' }).click();
	const preview = page.getByRole('form', { name: 'Card preview' });
	await expect(preview.getByLabel('Pile').locator('option:checked')).toHaveText('New pile: garden');
	await preview.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('region', { name: 'garden' })).toContainText('Plant tomatoes');
});

test('when Claude is down, the thought is still caught', async ({ page }) => {
	await page.getByLabel('Catch a thought').fill('[fail] Call the plumber');
	await page.getByRole('button', { name: 'Catch' }).click();
	const preview = page.getByRole('form', { name: 'Card preview' });
	await expect(preview.getByRole('status')).toContainText("Couldn't sort this one automatically");
	await expect(preview.getByRole('button', { name: 'Save' })).toBeDisabled();
	await preview.getByLabel('Pile').selectOption({ label: 'house' });
	await preview.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('region', { name: 'house' })).toContainText(
		'[fail] Call the plumber'
	);
});

test('cancel returns to the text without saving', async ({ page }) => {
	await page.getByLabel('Catch a thought').fill('Paint the TIE fighter');
	await page.getByRole('button', { name: 'Catch' }).click();
	await page.getByRole('button', { name: 'Cancel' }).click();
	await expect(page.getByLabel('Catch a thought')).toHaveValue('Paint the TIE fighter');
	await expect(page.getByRole('region', { name: 'model building' })).not.toContainText(
		'TIE fighter'
	);
});

test('marking a card done can be undone', async ({ page }) => {
	await capture(page, 'Paint the Y-wing');
	const pile = page.getByRole('region', { name: 'model building' });
	await pile.getByRole('button', { name: 'Mark "Paint the Y-wing" done' }).click();
	await expect(pile).not.toContainText('Paint the Y-wing');
	await expect(
		page.getByRole('status').filter({ hasText: 'Done: Paint the Y-wing' })
	).toBeVisible();
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(pile).toContainText('Paint the Y-wing');
});

test('pressing n focuses the capture box', async ({ page }) => {
	await page.locator('body').click();
	await page.keyboard.press('n');
	await expect(page.getByLabel('Catch a thought')).toBeFocused();
});

test('quick-add catches a thought and stays ready for the next', async ({ page }) => {
	await gotoReady(page, '/quick-add');
	await expect(page.getByRole('link', { name: 'Manage piles' })).toHaveCount(0);
	await capture(page, 'Beat the next game level');
	await expect(page.getByLabel('Catch a thought')).toHaveValue('');
	await gotoReady(page, '/');
	await expect(page.getByRole('region', { name: 'video games' })).toContainText(
		'Beat the next game level'
	);
});

test('the preview is locked while saving', async ({ page }) => {
	let release: () => void = () => {};
	const gate = new Promise<void>((resolve) => (release = resolve));
	await page.route('**/api/cards', async (route) => {
		await gate;
		await route.continue();
	});
	await page.getByLabel('Catch a thought').fill('Paint the A-wing');
	await page.getByRole('button', { name: 'Catch' }).click();
	const preview = page.getByRole('form', { name: 'Card preview' });
	await preview.getByRole('button', { name: 'Save' }).click();
	await expect(preview.getByRole('button', { name: 'Saving…' })).toBeDisabled();
	await expect(preview.getByRole('button', { name: 'Cancel' })).toBeDisabled();
	await page.keyboard.press('Escape');
	await expect(preview).toBeVisible();
	release();
	await expect(page.getByRole('status').filter({ hasText: 'Caught ✓' })).toBeVisible();
	await expect(page.getByRole('region', { name: 'model building' })).toContainText(
		'Paint the A-wing'
	);
});

test('proposed subtasks can be edited before saving', async ({ page }) => {
	await page.route('**/api/parse', (route) =>
		route.fulfill({
			json: {
				title: 'Build the shed',
				pile: null,
				notes: null,
				subtasks: ['Buy wood', 'Buy nails'],
				source: 'claude'
			}
		})
	);
	let saved: { subtasks: string[] } | undefined;
	await page.route('**/api/cards', async (route) => {
		saved = route.request().postDataJSON();
		await route.continue();
	});
	await page.getByLabel('Catch a thought').fill('Build the shed');
	await page.getByRole('button', { name: 'Catch' }).click();
	const preview = page.getByRole('form', { name: 'Card preview' });
	await preview.getByLabel('Subtask 1', { exact: true }).fill('  Buy treated wood ');
	await preview.getByLabel('Subtask 2', { exact: true }).fill('');
	await preview.getByLabel('Pile').selectOption({ label: 'house' });
	await preview.getByRole('button', { name: 'Save' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Caught ✓' })).toBeVisible();
	expect(saved?.subtasks).toEqual(['Buy treated wood']);
});

test('a sort with no pile asks you to pick one', async ({ page }) => {
	await page.route('**/api/parse', (route) =>
		route.fulfill({
			json: { title: 'Build the shed', pile: null, notes: null, subtasks: [], source: 'claude' }
		})
	);
	await page.getByLabel('Catch a thought').fill('Build the shed');
	await page.getByRole('button', { name: 'Catch' }).click();
	const preview = page.getByRole('form', { name: 'Card preview' });
	await expect(preview).toContainText('Pick a pile for this one, then save.');
	await expect(preview).not.toContainText('belongs on');
});

test('the capture box and notes stop at 1000 characters', async ({ page }) => {
	const box = page.getByLabel('Catch a thought');
	await box.fill('x'.repeat(1200));
	await expect(box).toHaveValue('x'.repeat(1000));

	await box.fill('Paint the B-wing');
	await page.getByRole('button', { name: 'Catch' }).click();
	const notes = page.getByRole('form', { name: 'Card preview' }).getByLabel('Notes');
	await notes.fill('y'.repeat(1200));
	await expect(notes).toHaveValue('y'.repeat(1000));
});

test.describe('daily allowance', () => {
	test('past 20 sorts a day, the preview asks you to pick the pile', async ({ page }) => {
		await logOut(page);
		const email = await signUp(page);
		seedParseUsage(email, 20);

		await page.getByLabel('Catch a thought').fill('Paint the Y-wing');
		await page.getByRole('button', { name: 'Catch' }).click();
		const preview = page.getByRole('form', { name: 'Card preview' });
		await expect(preview.getByRole('status')).toHaveText(
			"You've used today's 20 Claude sorts. Pick a pile yourself; sorting is back tomorrow."
		);
		await expect(preview.getByRole('button', { name: 'Save' })).toBeDisabled();
		await preview.getByLabel('Pile').selectOption({ label: 'model building' });
		await preview.getByRole('button', { name: 'Save' }).click();
		await expect(page.getByRole('region', { name: 'model building' })).toContainText(
			'Paint the Y-wing'
		);
	});

	test("admins aren't counted toward the allowance", async ({ page }) => {
		await logOut(page);
		await signInAsAdmin(page, 'admin-3@e2e.test');
		seedParseUsage('admin-3@e2e.test', 20);

		await page.getByLabel('Catch a thought').fill('Paint the A-wing canopy');
		await page.getByRole('button', { name: 'Catch' }).click();
		const preview = page.getByRole('form', { name: 'Card preview' });
		await expect(preview).toBeVisible();
		await expect(preview.getByRole('button', { name: 'Save' })).toBeEnabled();
		await expect(preview.getByText(/used today's 20 Claude sorts/)).toHaveCount(0);
	});
});

test('a long unbroken title wraps instead of widening the page on a phone', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await capture(page, 'Supercalifragilisticexpialidociousantidisestablishmentarianism', 'house');
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBe(0);
});

test('with 200% text on a phone, the capture box keeps its width and nothing scrolls sideways', async ({
	page
}) => {
	await page.setViewportSize({ width: 320, height: 800 });
	await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
	const box = await page.getByLabel('Catch a thought').boundingBox();
	expect(box?.width).toBeGreaterThan(100);
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBe(0);
});
