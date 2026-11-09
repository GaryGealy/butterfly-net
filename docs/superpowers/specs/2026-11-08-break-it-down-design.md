# Break it down: AI steps with real links (issue #46)

## Intent

Some cards are really projects. Gary's example: "Learn more about graphs and how they apply to our
AI project". Today only a new capture gets subtasks, and only the ones the user spelled out. **Break
it down** asks Claude to turn an existing card into concrete steps, and to attach a real video,
article, or paper to the steps that are about learning something.

The links must be real. A link that 404s, or a made-up YouTube ID, is worse than no link.

## Goals

- A **Break it down** button on the card page (`/card/[id]`) for active cards.
- Claude reads the card's title, notes, pile name, and existing subtasks, searches the web, and
  proposes a short list of steps. Some steps carry one link each.
- The user ticks which proposed steps to keep, then presses **Add**. The kept steps save
  immediately and appear after the existing subtasks.
- A step with a link shows a round ↗ link button at the end of its row (mockup option B). It opens
  in a new tab.

## Non-goals

- Typing or editing a link by hand. Links only come from Break it down for now; a step's link goes
  away if the step is removed.
- Re-running on a single step, reordering, or nested steps.
- Using Break it down during capture (`/` and `/quick-add`). Capture stays as it is.
- Checking that links still work later (no link-rot sweep).

## Anti-goals (failure even if it "works")

- **Links that Claude invented.** Every link kept must be a URL that appeared in this request's web
  search results. A step whose link can't be matched to a search result keeps its text and drops the
  link.
- Losing what the user typed. Pressing Add must not throw away unsaved edits on the card page, and
  a later **Save** must not delete the new steps or their links.
- A link that isn't `http:` or `https:` ever reaching an `href`.
- Steps that repeat subtasks the card already has.

## Behaviour

1. The user presses **Break it down**. The button shows a working state ("Finding steps…"); the
   rest of the page stays usable. Expect 10–30 seconds.
2. The server calls Claude with web search enabled. It returns 3–8 steps (the builder may tune the
   range). Each step is a short action in the card's voice, under about 8 words like a card title,
   with an optional link: `{ text, url?, linkTitle? }`. `linkTitle` is the page's title, used for the
   link button's accessible name and tooltip ("Open: Graph Databases in 10 Minutes").
3. The proposals appear as a checklist under Subtasks, all ticked by default, with the link title
   and site shown so the user can judge them before keeping. Buttons: **Add N steps** and
   **Cancel**.
4. **Add** saves the ticked steps immediately, appended after existing subtasks, not done, and adds
   them to the on-page list without reloading the form, so unsaved edits elsewhere on the page
   survive. **Cancel** discards the proposals.
5. On the card's normal **Save**, links round-trip with their rows (the save action currently
   rebuilds subtasks from `subtask_text` / `subtask_done`; it needs the link too), so editing a
   step's text keeps its link and removing the row removes it.
6. The total stays within `MAX_SUBTASKS`. If the card is near the cap, only as many as fit can be
   kept, and the UI says so.

## Failure and limits

- **Daily limit:** a press counts as one sort against `DAILY_PARSE_LIMIT` (20 per UTC day), through
  the same `countParse` as capture. Admins aren't counted. When the user is out of sorts, the
  button says so and doesn't call Claude.
- **Timeout:** this call gets its own timeout, about 30 s (`BREAKDOWN_TIMEOUT_MS`). The capture
  parse timeout (5 s) is unchanged.
- **Failure** (timeout, refusal, bad output, no API key): show a short message ("Couldn't break this
  down right now. Try again later."), add nothing, and leave the card untouched. If Claude fails, the
  sort still counts, the same as capture today.
- **No links found** is fine: steps come back without links.

## Decided

- **Model:** `claude-haiku-5-5`, the same model as capture, with the basic web search server tool
  (`web_search_20250305`; Haiku doesn't get the dynamic-filtering version). Gary approved web search.
  Moving this feature to Sonnet is Gary's call if Haiku's results are weak.
- **Links verified against search results:** collect the URLs from the response's
  `web_search_tool_result` blocks and keep a step's `url` only if it matches one, after normalising
  trailing slashes and `www.`. Only `http(s)` URLs are kept.
- **Schema:** add a nullable `url` column and a nullable `link_title` column to `subtasks`
  (new Drizzle migration `0003_…`). Existing rows are unaffected.
- **Cost:** about a cent per search plus tokens; cap searches per press with `max_uses` (around 3–5).

## Calls made while writing this up (Claude's, for Gary to check)

- **The Haiku spike decides go or no-go.** If Haiku can't use web search reliably, stop and ask Gary
  before changing models.
- **Link titles come from the matched search result**, not from Claude's text, so the title can't be
  made up either.
- **Duplicates are matched on text, ignoring case and spacing.** New steps are checked against both
  the saved subtasks and the rows on the page, and the prompt also tells Claude not to repeat
  existing ones.
- **"How many fit" uses the larger of the saved list and the on-page list**, so a later Save can't
  push new steps past `MAX_SUBTASKS` and silently drop them.
- **Out of sorts shows before pressing.** The page load reads today's `parse_usage` count and the
  admin flag; the server still checks with `countParse` on every press.
- **Appending steps refreshes the card's search-index entry**, as `setSubtasks` does.
- **No manual migration step.** `deploy.yml` applies `0003` on the tag push.

## Left to the builder

- The prompt wording, the step count range, and `max_uses`.
- **Getting structured output alongside web search.** First spike whether `output_config.format`
  (JSON schema) works on Haiku together with the web search tool. If it doesn't, ask for JSON in the
  final text block and validate it with zod as `interpretResponse` does today. Either way the reply
  goes through a zod schema, and bad output means failure, as above.
- Endpoint shape. A JSON endpoint (`POST /api/cards/[id]/breakdown` to propose, plus one to append
  the kept steps), or form actions on the card page. It must check the card belongs to the signed-in
  user.
- Whether the server re-checks submitted URLs against the proposals it made. At minimum it validates
  the scheme and length on every write, including the normal Save.
- Exact styling, within DESIGN.md: link button at least 44 px, `rel="noopener noreferrer"`, and it
  works at 200% text on a 320 px phone.

## Testing

- Unit tests (Vitest): the request builder, interpreting a response (link kept only when it's in the
  search results, non-http links dropped, duplicates of existing subtasks dropped, cap respected),
  appending subtasks with links, and Save keeping links.
- e2e (Playwright): extend the fake client (`FAKE_CLAUDE=1`) with a deterministic breakdown reply,
  including one invented link that must be dropped. Cover ticking a subset and adding them,
  unsaved title edits surviving Add, a later Save keeping links, the ↗ button's accessible name, the
  out-of-sorts state, and the failure message.
- Before release, a live check on Gary's graphs card in production, judging link quality.
