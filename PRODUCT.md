# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Gary (the maker) and a handful of people he invites. They think faster than they file:
ideas arrive in the middle of something else, and they'd rather say a thought than type
it. Many have several pursuits (house projects, model building, video games, work) whose
someday-tasks get mixed together on index cards and sticky notes.

The job: get a thought down in seconds before it flutters away, then trust it's on the
right pile until it's done.

Growing to a public product is not a goal for the next year. Sign-up stays invite-only.

## Product Purpose

Butterfly Net is a digital stack of 3×5 cards. The user says or types a thought; Claude
turns it into a card with a short title, the pile it belongs on, and any extra detail as
notes or subtasks. The user glances at the preview, confirms, and the card sits on its
pile until they mark it done.

Success: capture is faster than reaching for a paper card, and no thought is lost.

## Positioning

To-do apps ask for a project, a date and a priority before they'll save. Butterfly Net
asks for nothing: Claude files the card, and the user confirms with one keypress. It is
built for rambling, dictated input, cutting "um, so I was thinking…" down to a short
to-do without making anything up.

## Operating Context

- **At the Mac:** a system-wide hotkey (a macOS Shortcut) opens the bare `/quick-add`
  page; the user speaks with macOS Dictation, presses Return to see the preview and
  Return again to save. Inside the app, **n** jumps to the capture box.
- **On the phone, on the go:** the site installed to the home screen as an app.
- Reviewing piles and marking cards done also happens, but catching is the main event.

## Capabilities and Constraints

- **Terminology:** a _card_ sits on a _pile_. You _catch_ a thought. Claude _sorts_ it into
  a _preview_; nothing saves until you confirm. A finished card is _done_ and goes to the
  _archive_, where it stays searchable and can be reopened.
- Claude proposes title, pile, notes and subtasks, and may suggest a new pile, including
  one the user names in the thought ("on the house pile"). The user can change anything.
- New accounts start with the piles _house_, _work stuff_, _ideas_, _video games_ and
  _model building_; piles can be added, renamed and reordered.
- **Never loses a thought:** if Claude is slow (5 s timeout), unavailable or over the
  allowance, the preview opens with the user's own words to file by hand.
- Cards yellow like paper as they age since they were caught, so neglected ones stand out.
- **Deliberately absent:** due dates, reminders, priorities, recurring tasks, sharing,
  integrations, offline capture, a built-in voice assistant (voice is the device's own
  dictation).
- **Invite-only:** sign-up needs a one-time invite link from an admin (`/invites`).
  Non-admins get 20 Claude sorts a day (UTC).
- **Text limits:** capture and notes 1000 characters, title 200, pile name 40, up to
  50 subtasks.
- **Stack:** SvelteKit with Svelte 5 and Tailwind 4, served as a Cloudflare Worker with
  D1; Claude Haiku at low effort does the sorting. The model and timeout don't change
  without Gary's say-so.

## Brand Commitments

- **Name and metaphor:** Butterfly Net. "Thoughts are like butterflies: if you don't catch
  them, they flutter away." The index card (3×5) is the core object.
- **Voice:** plain and warm. Lead with the feeling ("catch the thought before it's
  gone"), then the speed ("one hotkey, one keypress"). Always "Claude sorts it, you
  confirm"; never suggest it saves or acts on its own.
- **Tagline candidates:** "Catch every thought." · "Say it. It's sorted." · "Your index
  cards, sorted for you."
- An incumbent visual system ("Meadow") ships in the code; it is the design authority
  until DESIGN.md records or replaces it.

## Evidence on Hand

- Product and messaging brief: `docs/marketing.md`. Original spec:
  `docs/superpowers/specs/2026-09-30-butterfly-net-design.md`.
- App icons and manifest in `static/`.
- Real cards from the product may be used as examples.
- **None exist and must not be invented:** user counts, testimonials, reviews, press,
  pricing.

## Product Principles

1. **Capture beats organizing.** Every step between a thought and a saved card must earn
   its place; the bar is a paper card.
2. **Claude proposes, the person decides.** Nothing saves or changes without confirmation.
3. **Never lose a thought.** Every failure path ends with the user's own words intact.
4. **Someday, not scheduled.** Resist dates, priorities and project-manager features.
5. **Small and personal.** Built for a few people who know each other, not for scale or
   growth.

## Accessibility & Inclusion

WCAG 2.2 AA. Voice-first capture relies on the device's dictation, so the capture flow
must work fully by keyboard and with screen readers.
