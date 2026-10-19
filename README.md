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

Without an API key, capture still works: every card comes back unsorted for you to file.

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

## Release

Production deploys only when a `v*` tag is pushed:

```bash
git tag v0.1.0 && git push origin v0.1.0
```

## Backups

D1 export can't include virtual tables. `cards_fts` is derived data: drop it, export, then
recreate it (see `drizzle/0001_cards_fts.sql`) and re-save cards to rebuild the index.
