import { expect, test, type Page } from '@playwright/test';
import { capture, seedParseUsage, signUp, waitForHydration } from './helpers';

async function openCard(page: Page, title: string) {
	await page.getByRole('link', { name: title }).click();
	await waitForHydration(page);
}

test('break a card down and keep two steps', async ({ page }) => {
	await signUp(page);
	await capture(page, 'Learn about graphs');
	await openCard(page, 'Learn about graphs');

	// An unsaved edit, which pressing Add must not throw away.
	await page.getByLabel('Title').fill('Learn about graph databases');

	await page.getByRole('button', { name: 'Break it down' }).click();
	const suggestions = page.getByRole('group', { name: 'Suggested steps' });
	await expect(suggestions.getByRole('checkbox')).toHaveCount(3);
	await suggestions.getByLabel('Read the GraphRAG paper').uncheck();
	await page.getByRole('button', { name: 'Add 2 steps' }).click();

	await expect(page.getByRole('status').filter({ hasText: 'Added 2 steps' })).toBeVisible();
	await expect(suggestions).toHaveCount(0);
	await expect(page.getByLabel('Title')).toHaveValue('Learn about graph databases');
	const link = page.getByRole('link', { name: 'Open: Graph Databases in 10 Minutes' });
	await expect(link).toHaveAttribute('href', 'https://example.com/graph-intro');
	await expect(link).toHaveAttribute('target', '_blank');
	await expect(page.getByRole('link', { name: /GraphRAG/ })).toHaveCount(0);

	await page.getByRole('button', { name: 'Save changes' }).click();
	await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
	await page.reload();
	await waitForHydration(page);
	await expect(page.getByLabel('Title')).toHaveValue('Learn about graph databases');
	await expect(page.getByLabel('Subtask 1', { exact: true })).toHaveValue(
		'Watch an intro to graph databases'
	);
	await expect(page.getByLabel('Subtask 2', { exact: true })).toHaveValue(
		'Sketch where a graph fits'
	);
	await expect(page.getByLabel('Subtask 3', { exact: true })).toHaveCount(0);
	await expect(
		page.getByRole('link', { name: 'Open: Graph Databases in 10 Minutes' })
	).toBeVisible();
});

test('a failed breakdown adds nothing', async ({ page }) => {
	await signUp(page);
	await capture(page, '[fail] Learn graphs', 'house');
	await openCard(page, '[fail] Learn graphs');

	await page.getByRole('button', { name: 'Break it down' }).click();
	await expect(page.getByRole('alert')).toHaveText(
		"Couldn't break this down right now. Try again later."
	);
	await expect(page.getByRole('group', { name: 'Suggested steps' })).toHaveCount(0);
	await expect(page.getByLabel('Subtask 1', { exact: true })).toHaveCount(0);
});

test('out of sorts, the button says so before it is pressed', async ({ page }) => {
	const email = await signUp(page);
	await capture(page, 'Learn about graphs');
	seedParseUsage(email, 20);
	await openCard(page, 'Learn about graphs');

	await expect(page.getByRole('button', { name: 'Break it down' })).toBeDisabled();
	await expect(page.getByText("You're out of sorts for today.")).toBeVisible();
});

test('done cards have no Break it down button', async ({ page }) => {
	await signUp(page);
	await capture(page, 'Learn about graphs');
	await openCard(page, 'Learn about graphs');
	await page.getByRole('button', { name: 'Mark done' }).click();
	await expect(page.getByRole('button', { name: 'Reopen' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Break it down' })).toHaveCount(0);
});

test('with 200% text on a 320px phone the suggestions fit without sideways scrolling', async ({
	page
}) => {
	await signUp(page);
	await capture(page, 'Learn about graphs');
	await page.setViewportSize({ width: 320, height: 640 });
	await openCard(page, 'Learn about graphs');
	await page.getByRole('button', { name: 'Break it down' }).click();
	await expect(page.getByRole('group', { name: 'Suggested steps' })).toBeVisible();
	await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBeLessThanOrEqual(0);
});
