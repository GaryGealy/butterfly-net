# Invite-only sign-up and a daily Claude allowance

Issue: #15 ("Lock down AI usage"). Status: design approved in chat 2026-11-02; awaiting spec review.

## Why

Every catch calls Claude on Gary's Anthropic key. Today anyone can sign up, and `/api/parse`
has no limit, so a stranger or a script could run up the bill. Butterfly Net is for Gary and a
few people he invites, so:

1. **Only invited people can sign up**, through a one-time invite link that Gary creates.
2. **Each user gets 20 Claude sorts a day.** After that, catching still works the way it does
   when Claude is down: the preview opens with the user's words and they pick the pile.

A monthly spend limit on the Anthropic workspace, set by hand in the Console, backs both up.

Out of scope: bring-your-own-key, payments, a CAPTCHA, emailing invites, showing a
remaining-sorts counter before the limit is reached, and password reset.

## Admin

- `ADMIN_EMAILS` is a comma-separated list in `wrangler.toml` `[vars]`, set to
  `gary.m.gealy@gmail.com`. It is not a secret.
- `isAdmin(user)` compares the signed-in user's email (already lowercased) with the list. There
  is no database column.
- Admins can open `/invites` and are exempt from the daily allowance.

## Invites

### Data

New table `invites`:

| column | type | notes |
|---|---|---|
| `id` | text PK | UUID |
| `code` | text, unique | 22-character base64url string from 16 random bytes (`crypto.getRandomValues`) |
| `created_by` | text → `users.id`, cascade | the admin who made it |
| `created_at` | integer ms | |
| `expires_at` | integer ms | `created_at` + 14 days |
| `used_at` | integer ms, null | set when claimed |
| `used_by` | text → `users.id`, set null on delete, nullable | the account it created |

### Server (`src/lib/server/invites.ts`)

- `createInvite(db, adminId)` → `{ code, expires_at }`.
- `findUsableInvite(db, code)` → the invite if it exists, is unused and hasn't expired. Otherwise
  null.
- `claimInvite(db, code)` does a single
  `UPDATE … SET used_at = now WHERE code = ? AND used_at IS NULL AND expires_at > now RETURNING id`.
  Of two simultaneous sign-ups, only one gets the row.
- `releaseInvite(db, id)` sets `used_at` back to null. It runs when account creation fails after
  the claim, for example because the email is taken.
- `markInviteUsed(db, id, userId)` sets `used_by`.
- `revokeInvite(db, adminId, id)` deletes an unused invite.
- `listInvites(db)` returns unused (unexpired) invites and used ones with the joiner's email,
  newest first. Expired, unused invites are not listed.

### Sign-up

- The invite link is `/signup?invite=<code>`.
- **`/signup` load:** with a usable code, it returns the code and the form shows, with the code in a
  hidden field. Without a code, or with a bad, used or expired one, the page shows
  "Butterfly Net is invite-only right now. Ask the person who told you about it for an invite link." There is no form and no
  hint about which of those it was.
- **`/signup` action:**
  1. Validate the credentials (unchanged).
  2. `claimInvite`; if it fails, return the invite-only error.
  3. `registerUser`; if it throws, `releaseInvite` and return the error as today.
  4. `markInviteUsed`, create the session and redirect home.
- **Log-in page:** the "New here? Create an account" link is removed.
- Existing accounts are unaffected.

### `/invites` page (admins only)

- A non-admin, signed-in user gets a 404 (the page's existence isn't revealed). Signed-out users
  are sent to log in, as for any page.
- **"Create invite link"** (form action `create`): shows the full link with a **Copy** button,
  which uses `navigator.clipboard` and says "Copied".
- **Unused links:** each shows when it expires, with a Copy button and a **Revoke** button
  (action `revoke`).
- **Used links:** each shows who joined and when.
- The header shows an **Invites** link, between "Manage piles" and the email chip, only for admins.
  The layout load passes `isAdmin`.

## Daily Claude allowance

- `DAILY_PARSE_LIMIT = 20` goes in `src/lib/limits.ts`.
- New table `parse_usage`: `user_id` (text → `users.id`, cascade), `day` (text `YYYY-MM-DD` in
  UTC), `count` (integer). The primary key is (`user_id`, `day`). Old rows stay; they are a few
  bytes each.
- `countParse(db, userId, now)` (in `src/lib/server/usage.ts`) runs a single
  `INSERT … ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1 RETURNING count`.
- **`/api/parse`:** for a non-admin, call `countParse` before Claude. If the count is over
  `DAILY_PARSE_LIMIT`, skip Claude and return `fallbackResult(text)` with `source: 'limit'`. Admins
  are not counted. Every request that would call Claude counts, including ones that time out.
- `ParseResult.source` gains `'limit'` alongside `'claude' | 'fallback'`.
- **CaptureBox:** for `source: 'limit'`, the preview notice reads "You've used today's 20 Claude
  sorts. Pick a pile yourself; sorting is back tomorrow." Otherwise it behaves exactly like
  `'fallback'`: no pile is chosen and Save stays disabled until one is.
- The day resets at midnight UTC, which is 6 pm or 7 pm in Central time.

## Migration and deploy

- One Drizzle migration (`drizzle/0002_*.sql`) adds both tables. The deploy workflow already runs
  `d1 migrations apply butterfly-net-db --remote` before deploying the Worker, so pushing the tag
  applies it.
- `ADMIN_EMAILS` ships in `wrangler.toml`, so no new secret is needed.

## Testing

**Unit tests (Vitest, local SQLite):**
- invites:
  - create
  - a usable code is found; used, expired or unknown codes are not
  - claim succeeds once; a second claim fails
  - release makes the code claimable again
  - revoke deletes only unused invites
  - list contents
- usage: counts 1…21 on one day; a new UTC day starts at 1; users are counted separately.
- `isAdmin`: matches case-insensitively, ignores spaces in the list, and is false when the list is
  empty.

**e2e tests (Playwright, `FAKE_CLAUDE`):**
- The `signUp` helper first inserts an invite into `e2e.db`, then signs up through
  `/signup?invite=…`, so every existing test exercises the real flow.
- `/signup` with no code, a bad code or a used code shows the invite-only message.
- The admin (an `ADMIN_EMAILS` value set for the test server) creates a link. A new user signs up
  through it, and the link then shows as used.
- A non-admin gets a 404 on `/invites` and sees no Invites link.
- After 20 catches in a day, the 21st opens the preview with the allowance notice, and the card
  saves after a pile is picked. The test seeds `parse_usage` to 20 rather than catching 20 times.

## Manual step (Gary)

Set a monthly spend limit for the API key's workspace in the Claude Console. It caps the bill
even if something gets past the checks above.
