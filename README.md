# butterfly-net

Digital 3×5 cards. Say or type a thought, Claude puts it on the right pile, you confirm.

## Develop

The repo needs Node ≥ 22.17; run `nvm use` (there's an `.nvmrc`). Installs currently need
npm 11 (`npx npm@11 install`) because npm 10.9 crashes on this lockfile.

```bash
npx npm@11 install
cp .dev.vars.example .dev.vars   # then add your ANTHROPIC_API_KEY
npm run db:migrate:dev
npm run dev
```

`npm run dev` reads the key from `.dev.vars` (through the Cloudflare adapter's platform
proxy), not from your shell, and stores data in `local.db` (SQLite). `.dev.vars` is
gitignored and never ends up in the generated types. Without an API key, capture still
works: every card comes back unsorted for you to file.

To run the production build against a local D1 database (what CI does), use
`npm run build && bash scripts/ci-d1-smoke.sh`. Plain `npm run preview` needs a D1 binding
in `wrangler.toml` first (see _First deploy_).

## Test

```bash
npm run test:unit -- --run   # Vitest, in-memory SQLite
npm run test:e2e             # Playwright, fake Claude, throwaway e2e.db
```

Live check of Claude's sorting (costs a few cents): `ANTHROPIC_API_KEY=… npx tsx scripts/smoke-parse.ts`

## Install it like an app

- **Mac (Chrome):** open the site → ⋮ menu → _Cast, save, and share_ → _Install page as app_. It gets its own window and Dock icon, and opens from Spotlight.
- **Mac (Safari):** File → _Add to Dock_.
- **iPhone (Safari):** Share → _Add to Home Screen_.

## A system-wide quick-add hotkey (macOS)

1. Open **Shortcuts** → **+** (new shortcut) → name it _Catch a thought_.
2. Add the action **Open URLs** with `https://<your-domain>/quick-add`.
3. Open the shortcut's info panel (ⓘ) → **Add Keyboard Shortcut** → press e.g. ⌃⌥Space.

Inside the app, press **n** to jump to the capture box.

## Dictate instead of typing (macOS)

Voice is the main way to catch a thought; the app just sees text.

1. **System Settings → Keyboard → Dictation:** turn it on and pick the Mac's
   connected mic as the input.
2. Press the hotkey above, press the Dictation shortcut (🎤 key, or **fn** twice),
   say the thought, then press **Return** to see the preview and **Return** again to
   save it. Rambling is fine — Claude trims it to a short title and keeps the detail
   in notes.

## First deploy

One-time setup. Each step creates something outside this repo, so do them deliberately.

1. Create the database: `npx wrangler d1 create butterfly-net-db`
2. Add the block it prints to `wrangler.toml`, with `migrations_dir` (wrangler defaults to
   `migrations/`, but the migrations live in `drizzle/`):

   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "butterfly-net-db"
   database_id = "<the id wrangler printed>"
   migrations_dir = "drizzle"
   ```

3. `npm run gen` to confirm the generated types still match (`git diff` should stay empty).
4. Create the Pages project and its secret:

   ```bash
   npx wrangler pages project create butterfly-net --production-branch=main
   npx wrangler pages secret put ANTHROPIC_API_KEY --project-name=butterfly-net
   ```

5. Give GitHub Actions a Cloudflare API token (with Pages and D1 edit rights) and the
   account id. Check `gh auth status` first: the active account must be `GaryGealy`
   (`gh auth switch --user GaryGealy` if not).

   ```bash
   gh secret set CLOUDFLARE_API_TOKEN --repo GaryGealy/butterfly-net
   gh secret set CLOUDFLARE_ACCOUNT_ID --repo GaryGealy/butterfly-net
   ```

6. Commit the `wrangler.toml` change, then push a `v*` tag (below). The deploy workflow
   applies the D1 migrations and deploys.

## Release

Production deploys only when a `v*` tag is pushed:

```bash
git tag v0.1.0 && git push origin v0.1.0
```

## Backups

D1 export can't include virtual tables. `cards_fts` is derived data: drop it, export, then
recreate it (see `drizzle/0001_cards_fts.sql`) and re-save cards to rebuild the index.
