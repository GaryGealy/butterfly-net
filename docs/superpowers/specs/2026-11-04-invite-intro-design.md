# Invite intro: "Here's Butterfly Net"

Branch: `intro-vid`. Status: design approved in chat 2026-11-04; awaiting spec review.

## Why

New people arrive through an invite link Gary sends, often by text, and land straight on a
sign-up form for an app they haven't seen. Before they make an account, they should see in
about half a minute what Butterfly Net is: catch a thought, Claude sorts it onto a pile, and
the card waits there, ageing like paper until it's dealt with.

Out of scope: a public intro page, a rewatch link for signed-in users, recording whether
someone watched, audio, a downloadable video file, and covering done/archive in the demo.

## Flow

- Invite links become `/welcome?invite=CODE`. Both places that build them change: the
  `created` link returned by `src/routes/invites/+page.server.ts` and `linkFor` in
  `src/routes/invites/+page.svelte`.
- `/welcome` (`src/routes/welcome/+page.server.ts` `load`):
  - signed in → redirect 303 to `/`;
  - no `invite` param, or `findUsableInvite` returns nothing → redirect 303 to
    `/signup?invite=CODE` (or `/signup` with no code), which already explains invite-only and
    rejected links;
  - otherwise → render the intro with the code.
- The intro is shown first but always skippable. **Skip to sign-up** (visible from the first
  second) and **Create my account** (at the end, and always present below the demo) both link
  to `/signup?invite=CODE`.
- `/signup` is unchanged. Links already sent as `/signup?invite=…` keep working and skip the
  intro.
- Nothing is stored: no "watched" flag, no new table or column, no migration.

## The page

`src/routes/welcome/+page.svelte`, no app header (like `/login` and `/signup`):

- The brand mark (butterfly in its leaf-tint circle) and one `h1`: "Here's Butterfly Net".
- The demo (below), then its caption line, then the controls row.
- **Create my account** (`btn-primary`) and **Skip to sign-up** (quiet text link). Skip sits
  above the demo so it is visible immediately; Create my account sits below the controls.
- Title: "Welcome · Butterfly Net".

## The demo

`src/lib/components/IntroDemo.svelte` renders a scripted re-creation of the real UI with sample
data, using the app's own classes and tokens (`rounded-field`, `shadow-float`, `chip`, the
`bg-pile-*` pastels, the `paper-*` ageing colours). It does not use `CaptureBox`, makes no
requests and saves nothing.

Three scenes, about 35 s in all:

1. **Catch a thought** (~10 s). The empty capture box with the placeholder "What's fluttering
   around?". "fix the squeaky hinge on the back door" types itself in at a natural pace; Catch
   presses and reads "Sorting…" for a moment.
   Caption: "A thought pops up? Catch it before it flutters off, from your Mac or your phone."
2. **Claude sorts it** (~12 s). The preview opens on the sage (house) tint with "Claude thinks
   this belongs on **house**. Edit anything, then save.", the title chip and a pile picker
   showing "house". A beat later Save presses.
   Caption: "Claude suggests a pile. Change anything you like, then save."
3. **Piles and ageing** (~13 s). The single butterfly drifts across once as the transition.
   Three pastel piles (house, work stuff, ideas) appear and the card settles onto house. A
   time-lapse label reads "1 week… 1 month… 4 months" while the card goes from white to
   cream to yellow and its "4mo" age label appears.
   Caption: "Cards wait on their piles. Leave one too long and it yellows like old paper."

End frame: the finished piles with "Catch it, let Claude sort it, come back when you're ready."
and a **Watch again** button.

### Timeline

The timing lives in `src/lib/intro/timeline.ts`, a plain module with no DOM or Svelte, so it can
be unit-tested:

- `SCENES`: the three scenes with `id`, `caption`, and `duration` in ms.
- A `createTimeline(scenes)` state machine exposing the current scene index, the elapsed time
  within it, `play()`, `pause()`, `seek(sceneIndex)`, `tick(ms)` (advances time; moves to the
  next scene when a scene's duration is used up; stops at the end) and `restart()`.
- The component drives `tick` from `requestAnimationFrame` while playing and derives each
  scene's visual steps (typing progress, button presses, colour stages) from the elapsed time.

### Playback

- Autoplays on load.
- A three-segment progress bar under the demo; each segment is a button that jumps to its
  scene, and the current one fills as it plays.
- One pause/play button. The demo also pauses while the tab is hidden
  (`visibilitychange`) and resumes when it comes back if it was playing.

### Motion

Meadow rules: ease-out, no bounce or spring, no sparkle or glow on Claude (it appears as a plain
sentence). The butterfly drift between scenes 2 and 3 is the one decorative moment.

## Accessibility

- The animated picture is `aria-hidden`. The current caption is real text in a polite live
  region, so it's announced as scenes change. A visually hidden transcript lists all three
  captions in order.
- Pause/play, the scene segments (with names like "Scene 2: Claude sorts it"), Watch again,
  Skip and Create my account are real buttons and links with the leaf focus ring and 44px
  targets. Nothing inside the picture takes focus.
- Pause/play satisfies WCAG 2.2.2 for motion that lasts longer than 5 s.
- **Reduced motion** (`prefers-reduced-motion: reduce`): nothing autoplays or animates. Each
  scene shows its finished frame with its caption, the segments act as tabs between the three
  frames, and the card is shown already yellowed. No typing, no drift.

## Layout

- The picture is drawn at a fixed design size and scaled to the available width with a CSS
  transform inside an aspect-ratio box, so a 320px phone sees the whole scene.
- Captions and controls sit outside the scaled picture, so they grow with large text like the
  rest of the app. No sideways scroll at 320px with 200% text.
- Max width matches the sign-up card's column on desktop, wider for the demo itself
  (`max-w-xl`).

## Performance

Svelte and CSS only, no new dependencies. Sample data is inline; no images or video.

## Testing

- **Unit** (`src/lib/intro/timeline.test.ts`): scene order and durations; `tick` crosses into
  the next scene and stops at the end; `pause` stops time; `seek` jumps and resets elapsed;
  `restart` returns to scene 1 playing.
- The `/welcome` load's redirects are covered by e2e, matching how the other routes are tested
  (there are no unit tests for route loads).
- **E2E** (`e2e/welcome.test.ts`):
  - an invite link from the Invites page is a `/welcome?invite=` link;
  - `/welcome?invite=CODE` shows the h1 and the demo;
  - Skip and Create my account both reach the sign-up form carrying the invite, and signing up
    still works;
  - a used or bogus code redirects to `/signup` and shows the existing message;
  - a signed-in visitor is sent to `/`;
  - `/signup?invite=CODE` still works directly;
  - with `reducedMotion: 'reduce'`, three still frames show and the segments switch them;
  - pause stops the caption from advancing.
- The audit pass (axe, 320px at 200% text) covers `/welcome` with no violations and no
  overflow.

## Docs

`DESIGN.md` gets a short "Intro demo" component entry (scenes, motion rule, reduced-motion
frames). `CLAUDE.md`'s invite line mentions `/welcome`.
