import { expect, test } from '@playwright/test';
import {
	capture,
	localIsoDay,
	setCaughtDaysAgo,
	setDueOn,
	signUp,
	waitForHydration
} from './helpers';

test('edit a card: title, notes, pile, and subtasks', async ({ page }) => {
	await signUp(page);
	await capture(page, 'Build the TIE fighter kit');
	await page.getByRole('link', { name: 'Build the TIE fighter kit' }).click();
	await waitForHydration(page);

	await page.getByLabel('Title').fill('Build the TIE interceptor kit');
	await page.getByLabel('Notes').fill('Bandai 1/72');
	await page.getByRole('button', { name: 'Add subtask' }).click();
	await page.getByLabel('Subtask 1', { exact: true }).fill('Prime the parts');
	await page.getByRole('button', { name: 'Add subtask' }).click();
	await page.getByLabel('Subtask 2', { exact: true }).fill('Paint the panels');
	await page.getByLabel('Subtask 1 done').check();
	await page.getByLabel('Pile').selectOption({ label: 'ideas' });
	await page.getByRole('button', { name: 'Save changes' }).click();
	await expect(page.getByRole('status')).toHaveText('Saved');

	await page.reload();
	await waitForHydration(page);
	await expect(page.getByLabel('Title')).toHaveValue('Build the TIE interceptor kit');
	await expect(page.getByLabel('Notes')).toHaveValue('Bandai 1/72');
	await expect(page.getByLabel('Subtask 1', { exact: true })).toHaveValue('Prime the parts');
	await expect(page.getByLabel('Subtask 1 done')).toBeChecked();
	await expect(page.getByLabel('Subtask 2 done')).not.toBeChecked();
	await expect(page.getByLabel('Pile').locator('option:checked')).toHaveText('ideas');
});

test('mark done, reopen, and delete from the card page', async ({ page }) => {
	await signUp(page);
	await capture(page, 'Paint the AT-AT');
	await page.getByRole('link', { name: 'Paint the AT-AT' }).click();
	await waitForHydration(page);

	await page.getByRole('button', { name: 'Mark done' }).click();
	await expect(page.getByRole('button', { name: 'Reopen' })).toBeVisible();
	await page.getByRole('button', { name: 'Reopen' }).click();
	await expect(page.getByRole('button', { name: 'Mark done' })).toBeVisible();

	await page.getByRole('button', { name: 'Delete card' }).click();
	await page.getByRole('button', { name: 'Yes, delete it' }).click();
	await expect(page).toHaveURL('/');
	await expect(page.getByRole('link', { name: 'Paint the AT-AT' })).toHaveCount(0);
});

test("another user's card is not found", async ({ page, browser }) => {
	await signUp(page);
	await capture(page, 'Paint the secret kit');
	await page.getByRole('link', { name: 'Paint the secret kit' }).click();
	await expect(page).toHaveURL(/\/card\/[^/]+$/);
	const cardUrl = page.url();

	const otherContext = await browser.newContext();
	const other = await otherContext.newPage();
	await signUp(other);
	const response = await other.goto(cardUrl);
	expect(response?.status()).toBe(404);
	await otherContext.close();
});

test('saving resyncs subtask rows with what the server kept', async ({ page }) => {
	await signUp(page);
	await capture(page, 'Sort the Lego bricks');
	await page.getByRole('link', { name: 'Sort the Lego bricks' }).click();
	await expect(page).toHaveURL(/\/card\/[^/]+$/);

	const add = page.getByRole('button', { name: 'Add subtask' });
	await add.click();
	await page.getByLabel('Subtask 1', { exact: true }).fill('First');
	await add.click(); // left blank
	await add.click();
	await page.getByLabel('Subtask 3', { exact: true }).fill('Third');
	await page.getByLabel('Subtask 3 done').check();
	await page.getByRole('button', { name: 'Save changes' }).click();
	await expect(page.getByRole('status')).toHaveText('Saved');

	await expect(page.getByLabel('Subtask 3', { exact: true })).toHaveCount(0);
	await expect(page.getByLabel('Subtask 1', { exact: true })).toHaveValue('First');
	await expect(page.getByLabel('Subtask 2', { exact: true })).toHaveValue('Third');
	await expect(page.getByLabel('Subtask 1 done')).not.toBeChecked();
	await expect(page.getByLabel('Subtask 2 done')).toBeChecked();
});

test("another user's card cannot be changed through its actions", async ({ page, browser }) => {
	await signUp(page);
	await capture(page, 'Paint the hidden kit');
	await page.getByRole('link', { name: 'Paint the hidden kit' }).click();
	await expect(page).toHaveURL(/\/card\/[^/]+$/);
	const cardUrl = page.url();

	const otherContext = await browser.newContext();
	const other = await otherContext.newPage();
	await signUp(other);
	const origin = new URL(cardUrl).origin;
	const post = (action: string, form: Record<string, string>) =>
		other.request.post(`${cardUrl}?/${action}`, { form, headers: { origin } });

	for (const [action, form] of [
		['save', { title: 'Hijacked', notes: 'x', pileId: 'nope' }],
		['done', {}],
		['delete', {}]
	] as const) {
		const res = await post(action, form);
		expect(res.status(), action).toBe(404);
	}
	await otherContext.close();

	await expect(page.getByLabel('Title')).toHaveValue('Paint the hidden kit');
	await page.reload();
	await waitForHydration(page);
	await expect(page.getByLabel('Title')).toHaveValue('Paint the hidden kit');
	await expect(page.getByRole('button', { name: 'Mark done' })).toBeVisible();
});

test("change a card's priority on its page", async ({ page }) => {
	await signUp(page);
	await capture(page, 'Sand the hull');
	const row = page.getByRole('listitem').filter({ hasText: 'Sand the hull' });
	await expect(row).not.toContainText('priority');

	await page.getByRole('link', { name: 'Sand the hull' }).click();
	await waitForHydration(page);
	await expect(page.getByRole('radio', { name: 'Medium' })).toBeChecked();
	await page.getByText('Low', { exact: true }).click();
	await expect(page.getByRole('radio', { name: 'Low' })).toBeChecked();
	await page.getByRole('button', { name: 'Save changes' }).click();
	await expect(page.getByRole('status')).toHaveText('Saved');

	await page.reload();
	await waitForHydration(page);
	await expect(page.getByRole('radio', { name: 'Low' })).toBeChecked();
	await page.getByRole('link', { name: '← Piles' }).click();
	await expect(row).toContainText('Low priority');
});

test('set a due date on the card page and the board shows it', async ({ page }) => {
	await signUp(page);
	await capture(page, 'Mail the insurance form');
	const row = page.getByRole('listitem').filter({ hasText: 'Mail the insurance form' });
	await expect(row).not.toContainText('due');

	await page.getByRole('link', { name: 'Mail the insurance form' }).click();
	await waitForHydration(page);
	await expect(page.getByLabel('Due')).toHaveValue('');
	const day = localIsoDay(3);
	await page.getByLabel('Due').fill(day);
	await page.getByRole('button', { name: 'Save changes' }).click();
	await expect(page.getByRole('status')).toHaveText('Saved');

	await page.reload();
	await waitForHydration(page);
	await expect(page.getByLabel('Due')).toHaveValue(day);
	await page.getByRole('link', { name: '← Piles' }).click();
	const weekday = new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', {
		weekday: 'short',
		timeZone: 'UTC'
	});
	await expect(row).toContainText(weekday);
	await expect(row.getByTitle(/^Due /)).toBeVisible();
});

test('clear the due date and the board label is gone', async ({ page }) => {
	const email = await signUp(page);
	await capture(page, 'Return the library books');
	setDueOn(email, 'Return the library books', localIsoDay(1));
	await page.reload();
	const row = page.getByRole('listitem').filter({ hasText: 'Return the library books' });
	await expect(row).toContainText('Tomorrow');

	await page.getByRole('link', { name: 'Return the library books' }).click();
	await waitForHydration(page);
	await page.getByRole('button', { name: 'Clear' }).click();
	await expect(page.getByLabel('Due')).toHaveValue('');
	await page.getByRole('button', { name: 'Save changes' }).click();
	await expect(page.getByRole('status')).toHaveText('Saved');

	await page.getByRole('link', { name: '← Piles' }).click();
	await expect(row).toBeVisible();
	await expect(row).not.toContainText('Tomorrow');
	await expect(row).not.toContainText('due');
});

test('a card due yesterday says Overdue on the board', async ({ page }) => {
	const email = await signUp(page);
	await capture(page, 'Pay the water bill');
	setDueOn(email, 'Pay the water bill', localIsoDay(-1));
	await page.reload();
	const row = page.getByRole('listitem').filter({ hasText: 'Pay the water bill' });
	await expect(row).toContainText('Overdue');
	await expect(row.getByTitle(/^Overdue: was due /)).toBeVisible();
});

test('a due card shows its due label instead of its age', async ({ page }) => {
	const email = await signUp(page);
	await capture(page, 'Trim pecan trees', 'house');
	await capture(page, 'Clean the garage', 'house');
	for (const title of ['Trim pecan trees', 'Clean the garage']) setCaughtDaysAgo(email, title, 30);
	setDueOn(email, 'Trim pecan trees', localIsoDay(1));
	await page.reload();

	const due = page.getByRole('listitem').filter({ hasText: 'Trim pecan trees' });
	await expect(due).toContainText('Tomorrow');
	await expect(due).not.toContainText('4w');
	await expect(due).toHaveAttribute('data-age', 'fresh');

	const undated = page.getByRole('listitem').filter({ hasText: 'Clean the garage' });
	await expect(undated).toContainText('4w');
	await expect(undated).toHaveAttribute('data-age', 'yellow');
});

test('a short title keeps its due label on the same line', async ({ page }) => {
	await page.setViewportSize({ width: 1100, height: 800 });
	const email = await signUp(page);
	await capture(page, 'Trim pecan trees', 'house');
	setDueOn(email, 'Trim pecan trees', localIsoDay(1));
	await page.reload();
	const row = page.getByRole('listitem').filter({ hasText: 'Trim pecan trees' });
	const title = await row.getByRole('link', { name: 'Trim pecan trees' }).boundingBox();
	const label = await row.getByTitle('Due tomorrow').boundingBox();
	expect(label!.y).toBeLessThan(title!.y + title!.height);
});

test('with 200% text on a phone, a due card with a long title does not widen the board', async ({
	page
}) => {
	const email = await signUp(page);
	const title = 'Call the plumber about the boiler pressure valve and the leaking radiator';
	await capture(page, title, 'house');
	setDueOn(email, title, localIsoDay(-1));
	await page.setViewportSize({ width: 320, height: 800 });
	await page.reload();
	await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
	await expect(page.getByRole('listitem').filter({ hasText: 'Overdue' })).toBeVisible();
	const overflow = await page.evaluate(
		() => document.documentElement.scrollWidth - document.documentElement.clientWidth
	);
	expect(overflow).toBe(0);
});

test('a fresh card shows no age and says it was caught today', async ({ page }) => {
	await signUp(page);
	await capture(page, 'Sand the hull seams');
	const card = page.getByRole('listitem').filter({ hasText: 'Sand the hull seams' });
	await expect(card).toHaveAttribute('data-age', 'fresh');
	await expect(card).not.toContainText('caught');

	await page.getByRole('link', { name: 'Sand the hull seams' }).click();
	await waitForHydration(page);
	await expect(page.getByText('Caught today')).toBeVisible();
});
