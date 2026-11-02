import { expect, type Page } from '@playwright/test';
import Database from 'better-sqlite3';

export const PASSWORD = 'correct horse battery';

/** The dev server's database for the e2e run (see playwright.config.ts). */
export const E2E_DB = 'e2e.db';

function openE2eDb() {
	const db = new Database(E2E_DB);
	db.pragma('busy_timeout = 5000');
	return db;
}

/** Inserts a fresh invite straight into the e2e database and returns its code. */
export function createInviteCode(): string {
	const db = openE2eDb();
	try {
		const now = Date.now();
		db.prepare(
			`INSERT OR IGNORE INTO users (id, email, password_hash, created_at)
			 VALUES ('e2e-inviter', 'inviter@e2e.test', 'unused', ?)`
		).run(now);
		const code = crypto.randomUUID().replaceAll('-', '');
		db.prepare(
			`INSERT INTO invites (id, code, created_by, created_at, expires_at)
			 VALUES (?, ?, 'e2e-inviter', ?, ?)`
		).run(crypto.randomUUID(), code, now, now + 14 * 24 * 60 * 60 * 1000);
		return code;
	} finally {
		db.close();
	}
}

export async function signUp(page: Page, email = randomEmail()): Promise<string> {
	await gotoReady(page, `/signup?invite=${createInviteCode()}`);
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Create account' }).click();
	await expect(page).toHaveURL('/');
	await waitForHydration(page);
	return email;
}

export function randomEmail(): string {
	return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.dev`;
}

/** Signs up as one of the e2e admins, or logs in if a retried test already made the account. */
export async function signInAsAdmin(page: Page, email: string): Promise<void> {
	await gotoReady(page, '/login');
	await page.getByLabel('Email').fill(email);
	await page.getByLabel('Password').fill(PASSWORD);
	await page.getByRole('button', { name: 'Log in' }).click();
	// Wait for the outcome: the wrong-password alert (no account yet) or the piles page.
	const alert = page.getByRole('alert');
	await expect(alert.or(page.getByRole('link', { name: 'Manage piles' }))).toBeVisible();
	if (await alert.isVisible()) {
		await signUp(page, email);
		return;
	}
	await waitForHydration(page);
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
