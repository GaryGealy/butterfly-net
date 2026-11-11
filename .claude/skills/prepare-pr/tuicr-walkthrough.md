# Guided diff walkthrough in tuicr

_Progressive-disclosure reference for `/prepare-pr`. Read it when the skill points you here._

A **walkthrough** narrates the review guide stop by stop while the author drives
[tuicr](https://github.com/agavra/tuicr) in their own terminal. The point isn't to display the
diff — they can already see it. The point is that a guide written *for* a human is worth more
when it's anchored to the code it describes and someone is there to answer questions at each
stop. Problems found this way become commits on the open PR before anyone else has been asked
to review it.

Written against **tuicr 0.24.0** (`tuicr --version`). The CLI is small enough to check directly
if behavior here doesn't match: `tuicr review --help`, `tuicr review add --help`.

## The stops are already there

`/prepare-pr` posts the guide as a GitHub review with one inline comment per stop, so
`tuicr pr <n>` fetches them as remote review threads and renders them in the diff and in the
Comment Navigator. **There is no seeding step on this path.** Three consequences worth knowing
before you start:

- **The default view hides resolved threads.** Visibility is `:comments unresolved` (default),
  `:comments all` (resolved and outdated shown muted), or `:comments hide`. It's persisted
  per-session.
- **Resolving a stop is how you tick it off**, and it's durable — it lives on the PR, not in a
  local file. Nothing in the TUI resolves a thread; it happens on GitHub. After resolving, `:e`
  re-fetches in PR mode and the stop drops out of the default view.
- **Anyone can reply to a stop on GitHub**, and the reply shows up in the thread on the next
  `:e`. A local note the author types in tuicr is a different thing — see step 4 below.

To resolve a stop yourselves once you've walked it and agreed nothing needs to change:

```bash
# thread ids, with their anchors, so you can match them to stops
gh api graphql -f query='query($o:String!,$r:String!,$n:Int!){repository(owner:$o,name:$r){
  pullRequest(number:$n){reviewThreads(first:50){nodes{id isResolved path line}}}}}' \
  -F o=OWNER -F r=REPO -F n=N

gh api graphql -f query='mutation($t:ID!){resolveReviewThread(input:{threadId:$t}){thread{isResolved}}}' -F t=THREAD_ID
```

Only at the author's direction, and only for stops you actually walked.

## Before you start

**1. The TUI belongs to the user.** Never run `tuicr`, `tuicr -w`, or `tuicr pr` in a foreground
shell — they're interactive and will hang your turn. You only ever drive `tuicr review *`, which
is non-interactive and safe.

**2. Hand them the exact command,** with the real number already in it:

```bash
tuicr pr 125
```

If `tuicr` isn't installed, say so once and move on. The walkthrough is an enhancement; the stops
are on the PR either way.

**3. Find the session once they've launched.** The TUI writes a session file as soon as a review
target becomes active, and records the live one in `active_sessions.json`:

```bash
tuicr review list            # --repo defaults to `.`
tuicr review list --all      # every session everywhere, when you don't know the repo
```

`--repo` is a selector, not just a path: it takes `owner/repo`, `host/owner/repo`, or a repo/PR
URL — and a checkout path *additionally* surfaces PR sessions for that checkout's origin, so a
plain `list` in a worktree routinely returns both kinds. Every row carries `kind` (`local` or
`pr`), an `anchor`, and an `active` boolean. Match `kind` and `anchor` against what they actually
launched rather than grabbing the first `active` row, and ask if two rows both look live. A PR
slug (`gh:owner/repo/pr/N`) is self-contained and needs no `--repo`.

**4. Launching it for them, only if asked.** Upstream's own skill routes `HERDR_ENV=1` sessions
through a wrapper that blocks until the TUI exits, splits with `--focus`, and runs bare `tuicr`
with no target. All three are wrong for a guided walk — a walkthrough is a conversation held
*while* the TUI is open, and you need to hand it `pr <N>`. Split it yourself:

```bash
herdr pane split --current --direction right --cwd "$PWD" --no-focus   # → .result.pane.pane_id
herdr pane run <pane-id> "tuicr pr 125 --no-update-check"
```

## The loop

1. **Drive by line number.** Give each stop as a file plus a line, and tell them to jump with
   `:{N}` (`:o{N}` for the old side, which is what reaches a deletion). That works from anywhere,
   needs no pane focus, and can't be wrong. `m` / `M` step between comments; `Enter` in the
   Comment Navigator jumps to the selected one.

   For anything else, say "press `?`" rather than reciting keys from memory. The help popup is
   searchable (`/` inside it, `n`/`N` to step matches), which makes it a better answer than
   anything you'd recall.

2. **Narrate each stop.** Say what the code does, the claim to test, and what the reviewer has to
   *decide*. Don't restate the diff; they're looking at it.

3. **Answer questions from the codebase, not from tuicr.** It's a diff viewer — no
   go-to-definition, no find-references. When they ask "where is this called?", grep and answer.

4. **Read their notes on demand.** A comment the author writes in the TUI is a *local draft*
   stored in the session file, separate from the remote threads. It's on disk the moment they
   save it, so you can read it while the session is still open:

   ```bash
   tuicr review comments --session gh:owner/repo/pr/125
   ```

   Treat `comment_type` as intent: `issue` blocking, `suggestion` consider or explain, `note`
   answer, `praise` no action. There's no push stream — read when they say they're ready, and
   again after they exit. Batching several stops into one read costs nothing, and asking them to
   quit first is wasted ceremony.

5. **Act on findings.** See "Applying fixes mid-walk".

## Gotchas

These are the ones that actually cost time.

**Marking a hunk reviewed HIDES every comment inside it.** `r` (file) and `R` (hunk) don't just
set a flag — the marked region drops out of the Comment Navigator, so stops inside it become
unreachable by comment navigation. Nothing warns the user. Tell them before they start, and if
they mark a stop's hunk reviewed mid-walk, say plainly that the neighboring stops just went
invisible. Marking reviewed is a fine ack channel for regions you've *finished* — suggest it as
you leave a region, never as you enter one.

**Reviewed files can also be hidden outright.** Since 0.23.0, `H` in the file tree (or
`:set noreviewed` from any pane) hides every file already marked reviewed, and `show_reviewed =
false` in config starts a session that way — with nobody having touched anything during the walk.
It runs through the same `file_passes_filter()` gate as the exclusion filter, so a hidden file
leaves the tree, the diff pane, and `{`/`}` and `[`/`]` navigation together.

**An exclusion filter removes files from more than the tree.** With the file tree focused, `e`
prompts for a regex that *excludes* matching files (`i` includes; `E`/`I` clear). Hidden files
disappear from the diff pane, from `{`/`}` and `[`/`]` navigation, and from the header counts —
so a stop in a filtered-out file is simply unreachable while the filter is on. Filters reset on
restart but survive `:e`.

**Diagnose a "missing stops" report in this order.** Every cause is silent:

1. **A resolved thread** — expected, and the whole point. Confirm with `:comments all`.
2. **A reviewed hunk or file** — the count drops by exactly the stops in one region. Ask what
   they marked.
3. **An exclusion filter** — the count drops by exactly one file's worth. Check the tree's bottom
   border for active patterns.
4. **A stale in-memory copy** — `:e` reconciles it. Cheapest to try, so try it first.
5. **Hidden reviewed files** — `:set reviewed` brings them back. Suspect it when whole files, not
   individual stops, are missing and nobody set a filter.
6. **`dd`** — the only one that really deleted something. Conclude this last, never first.

**The gutter may not be showing absolute numbers.** `:set relativenumber` exists. `:{N}` still
jumps by absolute line, so your instructions keep working — but a number they read back off the
gutter may be relative to their cursor. If a quoted line doesn't match what you expect, have them
check with `:set norelativenumber` before either of you concludes the anchor drifted.

**Stop order is diff position, not guide order.** Files sort alphabetically, so a `migrations/`
file comes before `src/`, and stepping from the top can land on your last stop first. That's why
every stop is numbered in its own text. Say so up front, and offer: *"say 'next' and I'll narrate
in guide order."*

**A line comment needs the cursor on a diff line.** Off one, `c` silently gives a file comment
instead — attached to the file, not the line they were aiming at. Tell them before they hit it.

**`e` means two different things.** With the file tree focused it's the exclusion filter; anywhere
else it opens the focused file in `$EDITOR`.

**`:e` does not destroy comments.** It re-reads the diff and, in PR mode, re-fetches remote
threads. Everything survives. This is why a walk can absorb fixes without restarting — lean on it.

**There are no threaded replies.** The local `Comment` struct carries no parent field — threading
exists only in the GitHub structs (`GhReviewComment.replyTo`). Someone "replying" to a stop in the
TUI is really adding their own comment on the same line, sharing that stop's location exactly. In
PR mode a real reply has to go through GitHub
(`gh api repos/{owner}/{repo}/pulls/<n>/comments/<id>/replies` — the PR number is required,
and the shorter `pulls/comments/<id>/replies` form 404s), which is also how you answer a
question a reviewer left on one of your stops.

**`dd` destroys a stop, and nothing warns.** It's easy to hit while exploring, and it is the only
cause in the list below that actually removes anything — every other one hides a stop that still
exists. Rule the hiding causes out before concluding a comment was deleted; the CLI reports a
deleted stop's peers and a hidden stop's peers identically. On a PR session, count from
`review comments`, not `review list` — the listing's `comment_count` can report more than
`comments` actually returns.

## Applying fixes mid-walk

Only at the author's explicit direction. When they say "make that change":

1. Make it, run the standard checks (`npm run check && npm run lint && npm run test:unit -- --run`, plus `npm run test:e2e` for page or route changes), and compare against the pre-walk baseline — say
   plainly if a number moved. Know that baseline *before* the first fix; "nothing regressed" is
   only a claim you can make against a number you recorded.
2. Commit it separately from the original work, with its own message, so the walk's effect is
   legible in history. **Push it** — PR mode pulls its diff from GitHub, so an unpushed commit is
   invisible to the session.
3. Have them press `:e` to pull it in.

**Prefer batching fixes to the end.** Every edit shifts the line anchors of the stops below it,
and GitHub marks a moved thread outdated — which takes it out of the default view. Collecting
findings and applying them once, after the last stop, costs one round of drift instead of N, and
collapses N pushes into one.

Neither `tuicr pr <n>` nor `-r main..HEAD` shows uncommitted work: the first reads the pushed
branch, the second reads committed history. The header always shows the commit under review, so
"what does your header say?" is a one-question way to confirm you're both looking at the same
thing.

## Fallback: walking without a PR

When there's no PR to attach comments to — `--no-stops`, a non-GitHub forge, or a walk before the
PR exists — you seed the stops into a local session instead. Everything above still applies except
that the stops are local drafts rather than remote threads.

Ask them to launch the matching target first (`tuicr -r main..HEAD` for the branch,
`tuicr -w` for uncommitted work), because **`tuicr review add` errors if no session exists yet**:

```
Error: Invalid input: session '<slug>' was not found for repo .
```

Then seed one `add` per stop — there's no batch mode; `--input` takes a single JSON object and
rejects an array:

```bash
tuicr review add --session "<slug>" \
  --target-file src/routes/foo/handler.ts --line 100 --side new \
  --type issue --username "AI Agent" "STOP 6 — <the claim to test>"
```

- **Verify line anchors first.** `grep -n` every symbol a stop references. `add` validates the
  *path* (`session does not contain file <path>`) but never the line, so a wrong number is
  silently wrong.
- **Always pass `--username`.** It renders as `[@AI Agent]`, the only thing on screen separating
  your stops from their notes. Omit it and the comment is stamped `user`.
- **Pass `--type` explicitly.** It defaults to `none` — no type, no badge.
- **Record each `id`.** `add` echoes the created comment as JSON. Neither `add` nor `comments`
  reports an author, so your seeded IDs are the only reliable way to tell your stops from their
  notes on read-back. (The session file on disk *does* store `author`, and `review list` prints
  its `path` — that's the escape hatch if you lose the list.)
- **Seed by slug, never by file path.** `--session` accepts a path to a session JSON, but `add`
  resolves it back to the canonical session and writes *there*; consecutive adds against a copied
  file clobber one another.

Four things are worse on this path, and they're why the PR path is the default:

- **No resolution.** A local draft's lifecycle is `local_draft` → `pushed_draft` → `submitted`.
  The honest answer to "how do I tick stops off" is `dd`, or mark the hunk reviewed — not resolve.
- **You cannot delete a comment from the CLI.** `tuicr review` is `list`, `add`, `comments`.
  Cleanup is theirs: `dd` at the cursor, `:clear`, or `:clearc`. Never seed a stop you'd need to
  retract programmatically.
- **`dd` is easy to hit while exploring**, and a deleted stop is gone with no notice. Count from
  `review comments`, not from `review list` — the listing's `comment_count` can overreport. And
  rule out the three *hiding* causes above before re-seeding, because re-seeding mints a **new
  id**: update your list or the next read-back misattributes it as theirs.
- **Never `:submit` to close out the walk.** Submitting publishes every seeded scaffold comment to
  the forge at once — there is no per-comment publish. If they do want to promote one stop into
  real feedback, it's a three-move sequence: `dd` the rest, push the drafts that remain, then
  submit. Say this before they start.

Re-seeding mid-session? Ask them to `:e` first. The CLI writes to the file on disk while the TUI
holds its own copy in memory, and reloading first is the cheap way to avoid finding out which
copy wins.
