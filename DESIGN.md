---
name: Butterfly Net
description: Digital 3×5 cards on pastel piles in a quiet, friendly garden.
colors:
  ground: '#fbfaf3'
  ink: '#2e3a31'
  ink-soft: '#3e4c42'
  muted: '#5e6b61'
  line: '#ecefe6'
  leaf: '#2f6b4f'
  leaf-dark: '#1f4d37'
  leaf-tint: '#dde9d0'
  pile-sage: '#dde9d0'
  pile-sky: '#d6e4f0'
  pile-butter: '#f7e8b5'
  pile-lilac: '#e5ddf0'
  pile-peach: '#f8ddcb'
  pile-blush: '#f3e0e6'
  paper-cream: '#fcf5e1'
  paper-yellow: '#f8ebc6'
  paper-deep: '#f1dca6'
  paper-ink: '#7a520c'
  surface: '#ffffff'
typography:
  headline:
    fontFamily: 'Nunito, ui-rounded, system-ui, sans-serif'
    fontSize: '1.25rem'
    fontWeight: 800
    lineHeight: 1.375
  title:
    fontFamily: 'Nunito, ui-rounded, system-ui, sans-serif'
    fontSize: '1.125rem'
    fontWeight: 800
    lineHeight: 1.556
  capture:
    fontFamily: 'Nunito, ui-rounded, system-ui, sans-serif'
    fontSize: '1.125rem'
    fontWeight: 600
    lineHeight: 1.556
  body:
    fontFamily: 'Nunito, ui-rounded, system-ui, sans-serif'
    fontSize: '1rem'
    fontWeight: 700
    lineHeight: 1.5
  label:
    fontFamily: 'Nunito, ui-rounded, system-ui, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 700
    lineHeight: 1.43
rounded:
  chip: '1rem'
  patch: '1.5rem'
  field: '1.75rem'
  pill: '9999px'
spacing:
  xs: '0.5rem'
  sm: '0.75rem'
  md: '1rem'
  lg: '1.5rem'
  xl: '2rem'
components:
  button-primary:
    backgroundColor: '{colors.leaf}'
    textColor: '{colors.surface}'
    rounded: '{rounded.pill}'
    padding: '0 1.25rem'
    height: '2.75rem'
  button-primary-hover:
    backgroundColor: '{colors.leaf-dark}'
  button-soft:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink-soft}'
    rounded: '{rounded.pill}'
    padding: '0 1rem'
    height: '2.75rem'
  button-soft-hover:
    backgroundColor: '{colors.leaf-tint}'
  button-quiet:
    textColor: '{colors.ink-soft}'
    rounded: '{rounded.pill}'
    padding: '0 1rem'
    height: '2.75rem'
  field:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.chip}'
  capture-box:
    backgroundColor: '{colors.surface}'
    rounded: '{rounded.field}'
    padding: '0.75rem 0.75rem 0.75rem 1.25rem'
  pile-patch:
    backgroundColor: '{colors.pile-sage}'
    rounded: '{rounded.patch}'
    padding: '1rem'
  card-chip:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.chip}'
    padding: '0.375rem 0.875rem 0.375rem 0.375rem'
  card-chip-aged:
    backgroundColor: '{colors.paper-yellow}'
    textColor: '{colors.ink}'
  count-badge:
    textColor: '{colors.ink-soft}'
    rounded: '{rounded.pill}'
    padding: '0.125rem 0.625rem'
---

# Design System: Butterfly Net

## Overview

**Creative North Star: "The Butterfly Garden"**

Butterfly Net is a garden where thoughts land. The ground is a warm off-white. Piles are soft
pastel patches, like flower beds. Each card is a white chip resting on its patch. One
deep leaf green marks what's alive and actionable: the Catch and Save buttons, the
butterfly, focus. Everything is rounded, from Nunito's letterforms to pill buttons and
patch corners. The garden should feel friendly and lived-in, never busy.

The system is light and nearly flat. Depth comes from colour, white chips on pastel
patches on the ground, with only a breath of shadow to lift a chip or float the capture
box. Motion is limited to the butterfly drifting gently in the header and colour easing
in the preview. Copy speaks in the same voice ("What's fluttering around?", "Nothing here
yet. Nice and quiet."), so words and shapes carry the warmth together.

It is grown-up playfulness. It is not a productivity dashboard with charts, priority flags,
red badges or dense tables. It is not a dark, techy "AI" look with glowing gradients or
sparkle icons; Claude's work shows up as a plain sentence in the preview. It is not
cartoony either: no mascots and no bouncing.

**Key Characteristics:**

- Warm off-white ground, one leaf-green accent, six pastel pile colours.
- Rounded everything: Nunito type, pill buttons, generously curved patches.
- Depth by colour layering (ground → pastel patch → white chip), with whisper-soft shadows.
- Heavy type weights (700–800) at modest sizes; friendly rather than loud.
- Cards age like paper: cream, then yellow, then deep yellow, with a small age label.

## Colors

A soft garden palette: one confident green against warm neutrals and sun-faded pastels.

### Primary

- **Leaf Green** (`leaf`): the one action colour. Primary buttons, the butterfly mark,
  focus borders, the "Caught ✓" confirmation. Also the browser theme colour.
- **Deep Leaf** (`leaf-dark`): hover for primary buttons and the Undo label.
- **New Shoot** (`leaf-tint`): the butterfly's halo in the header, hover wash on soft
  buttons and the done-circle, the Undo button's ground.

### Secondary: Pile Pastels

Each pile wears a pastel by its position, repeating after six (`src/lib/pile-color.ts`):

- **Sage** (`pile-sage`), **Sky** (`pile-sky`), **Butter** (`pile-butter`),
  **Lilac** (`pile-lilac`), **Peach** (`pile-peach`), **Blush** (`pile-blush`).
- The capture preview takes the colour of the pile it's headed for. A new pile Claude
  proposes shows in Blush, and no pile yet shows in Line.

### Tertiary: Aging Paper

- **Cream** (`paper-cream`), **Yellowed** (`paper-yellow`), **Old Paper** (`paper-deep`):
  card backgrounds at 1 week, 4 weeks and 90 days old.
- **Sepia Ink** (`paper-ink`): the age label ("5w", "3mo") and the faint ring around aged
  cards (15–25% opacity) that keeps them distinct on the Butter pile.

### Neutral

- **Garden Ground** (`ground`): the page background everywhere.
- **Bark** (`ink`): primary text and headings.
- **Soft Bark** (`ink-soft`): secondary text, quiet buttons, count badges.
- **Moss Grey** (`muted`): nav links, hints, placeholders, empty states.
- **Pale Line** (`line`): field borders, dividers, the float shadow's hairline ring.
- **Petal White** (`surface`): card chips, the capture box, fields, the undo toast.

Two Tailwind defaults fill semantic gaps: red-700 for destructive actions (Delete, remove
subtask) and amber-900 for preview notices (Claude unavailable, daily allowance used).

### Named Rules

**The One Green Rule.** Leaf Green is the only saturated colour and it always means "act
here" or "this worked". Pastels decorate; they never mark an action.

**The Pastels Are Places Rule.** A pile colour belongs to a pile. Don't use pastels as
generic decoration, status colours or highlights.

## Typography

**Body Font:** Nunito (with ui-rounded, system-ui, sans-serif), self-hosted as one variable
woff2 per subset (latin, latin-ext) in `src/lib/assets/fonts`, so 500, 600, 700 and 800 are
all true weights.

**Character:** a single rounded sans does everything. Hierarchy comes from weight and a
small size step, not from a second family. The heavy weights read as friendly and sure of
themselves, not shouty.

### Hierarchy

- **Headline** (800, 1.25rem): the "Butterfly Net" wordmark and the preview's card title.
- **Title** (800, 1.125rem): pile names and page headings.
- **Capture** (600, 1.125rem): text typed or dictated into the capture box; placeholder at 500.
- **Body** (700, 1rem): card titles on piles, nav links, buttons (800 on primary).
- **Label** (700, 0.875rem): hints ("Press Enter to catch"), notices, the email chip,
  count badges (800), age labels (800).

### Named Rules

**The One Family Rule.** Nunito only. Build hierarchy from weight (500/600/700/800) and the
0.875–1.25rem range. Don't add a display face or go under 0.875rem.

**The Medium Placeholder Rule.** Placeholders drop to weight 500 in Moss Grey, so they never
look like typed text.

## Layout

A single centred column, at most 64rem wide (`max-w-5xl`), with 1rem side gutters that
open to 2rem from 640px. The header is a wrapping row: the wordmark on the left, then nav
links, the email chip and Log out pushed right.

The home page puts the capture box at the top, full width, with piles below in a grid:
one column on phones, two from 640px, three from 1024px, with 1.5rem gaps. Each pile
patch is at least 10rem tall, so an empty pile still reads as a place. Cards inside a
patch stack with 0.5rem between them.

Rhythm: 0.75rem inside rows, 1rem patch padding, 1.5rem between patches, 2rem between the
capture box and the piles. `/quick-add` drops the header entirely; it is just the capture
box.

Every tap target is at least 44px (`min-h-11` buttons, `size-11` done circles).

## Elevation & Depth

Depth comes from colour layering: Garden Ground, then a pastel patch, then a white chip.
Shadows are whispers in Bark at 8% opacity, never dark or dramatic.

### Shadow Vocabulary

- **Chip** (`box-shadow: 0 1px 2px rgb(46 58 49 / 0.08)`): card chips, fields, soft
  buttons, the email chip. Just enough to lift white off a pastel.
- **Float** (`box-shadow: 0 2px 10px rgb(46 58 49 / 0.08), 0 0 0 1px #ecefe6`): the capture
  box and the undo toast, the two things that sit above the garden.

### Named Rules

**The Float Is Rare Rule.** Only the capture box and transient toasts float. Piles never
cast shadows; they lie flat on the ground.

## Shapes

Soft and round at every scale. Pill shapes for all buttons, badges and the email chip.
Pile patches use 1.5rem corners, and the capture box and preview use 1.75rem, the largest
curve, for the most important surface. Cards and fields use 1rem. Icons are 1.8px
round-capped strokes (the butterfly, the net-and-plus capture glyph, the done circle) and
never filled.

There are no hard corners and no hairline-bordered boxes. Edges come from colour contrast,
with the Pale Line hairline ring only on floating elements.

## Components

### Buttons

Rounded pills, sure but gentle, all at least 44px tall.

- **Primary** (`btn-primary`): Leaf Green, white 800-weight label, 1.25rem side padding.
  Hover deepens to Deep Leaf; disabled at 50% opacity and doesn't change on hover. For Catch and Save.
- **Soft** (`btn-soft`): white with a chip shadow and a Soft Bark label. Hover washes to
  New Shoot.
- **Quiet** (`btn-quiet`): no fill, Soft Bark label. Hover is a 70% white wash. For Cancel
  and secondary actions.
- **Danger** (`btn-danger`): no fill, red-700 label, a red-50 hover. Only for destructive
  actions.

### Capture Box (signature)

The front door. A white field with 1.75rem corners and the float shadow. It has the
leaf-green net glyph on the left, a two-line borderless textarea in Capture type with "What's
fluttering around?" as placeholder, and a primary **Catch** button that reads "Sorting…"
while Claude works. Below it in Label type: "Press Enter to catch", and after a save a
leaf-green "Caught ✓ It landed on {pile}."

The textarea is at least two lines tall and grows with what's typed. When the box is
narrower than 17rem (large text sizes), Catch drops to its own line, right-aligned, so the
text keeps the width. The header and every page reflow without sideways scrolling up to
200% text on a 320px phone.

### Card Preview (signature)

Takes the place of the capture box once Claude replies. Its background is the target
pile's pastel and eases over 300ms when the pile changes. At the top, a butterfly and a
sentence ("AI thinks this belongs on **house**. Edit anything, then save.") or an
amber-900 notice. Then a white chip holding the editable title (Headline type), notes and
subtasks (hollow circles, ✕ to remove). Below that, a pill-shaped pile select and Save
and Cancel. Escape cancels.

### Break It Down (card page)

Under the card's subtasks, a **Break it down** soft button (it reads **Finding steps…** while
Claude searches, and is disabled with "You're out of sorts for today." when the allowance is
used). Suggestions appear in a white, bordered **Suggested steps** group: a checkbox per step
(all ticked), with the link's title and site in muted text under a linked step, then **Add N
steps** (primary) and **Cancel** (quiet). A subtask with a link shows a round leaf-tint ↗ button
(44 px, opens in a new tab, named "Open: <title>") between its text and ✕. Holds at 200% text on
a 320px phone.

### Intro Demo

Invite links open `/welcome` (it also opens without a code, for a shared company link), a skippable ~14 s re-creation (scenes of 3.5, 4.9 and 5.6 s) of the app built from its own
classes with sample data: **Catch a thought** (the thought types itself into the capture box,
Catch reads "Sorting…"), **AI sorts it** (the sage preview proposes **house**, Save presses)
and **Piles and ageing** (the butterfly drifts across once, the card lands on house and yellows
through cream to yellow with a "4mo" label). The picture is drawn at 30×19.5rem and scaled to
its box, so a phone sees all of it; captions and controls sit outside it and grow with text.
Each scene plays once and then waits on its last frame: the visitor moves on with **Next**
(arrow glyph), a soft white pill while a scene plays that turns primary Leaf once it is waiting.
Next also skips ahead mid-scene. After the last scene the end caption shows and the button reads
"Watch again". A three-segment progress bar beside it replays or jumps to any scene; with large
text on a phone, Next wraps below the bar. The demo pauses while the tab is hidden. Under reduced
motion nothing plays: each scene shows settled, and Next and the segments switch between them.

Nothing plays on arrival. The demo waits on its first frame under a Ground wash with a white
card: "New to Butterfly Net?", "A 14-second look at how it works.", a primary **Watch the demo**
(play glyph) and a quiet **Go straight to sign-up** link. Watch fades the card (200ms, none under
reduced motion), starts playback and moves focus to Next.
Captions and controls appear only once it starts. Card and picture share one grid cell, so with
large text the card grows the cell rather than being clipped; below 22rem its padding tightens.
The demo says "AI", never "Claude", like the rest of the interface.
Under the picture each part names itself: the scene title in Headline (800, 1.25rem, Bark)
over its sentence at 600, 1.125rem in Soft Bark, rising 6px into place over 250ms (instant
under reduced motion). Invisible copies of every caption share the cell, so the controls below
hold still at any width or text size.

### Pile Patches

A pastel rounded block (1.5rem corners, 1rem padding, no shadow). It has the pile name in
Title type and a count badge (a 70% white pill with Soft Bark 800 text). Empty patches
show a small butterfly and "Nothing here yet. Nice and quiet." in Soft Bark (Moss Grey
falls below 4.5:1 on most pastels).

### Card Chips

A white 1rem-rounded chip with the chip shadow. On the left, a 44px hollow done circle
that washes New Shoot and turns green on hover. Then the title in Body type, which links to
the card page and underlines on hover. As a card ages, its background moves to Cream,
Yellowed and Old Paper and gains a faint sepia ring. From 4 weeks it shows a right-aligned
Sepia Ink age label ("4w", "3mo", "1y"), with screen-reader text "caught 5 weeks ago".

### Inputs / Fields

`field`: white, 1rem corners, Pale Line border, chip shadow, 600-weight Bark text. Focus
moves the border and ring to Leaf Green. Selects in the preview are pill-shaped. Inside
the capture box and preview chip, inputs are borderless and transparent because the
container is the field. The capture box shows focus as a 2px Leaf Green ring around the
whole box. Each borderless field in the preview gets a 2px Leaf Green outline, 4px out,
so you can see which one has focus.

Everything else that takes keyboard focus (buttons, links) gets a 2px Leaf Green outline
2px out (`:focus-visible` in the base layer). Text selection is New Shoot, and the text
cursor is Leaf Green. Link underlines sit 0.2em below the text at 0.08em thick, clear of
Nunito's descenders.

### Navigation

The wordmark is the butterfly in a 40px New Shoot circle, drifting 4px with a ±3° rotation
over 3s (only with `motion-safe`), next to "Butterfly Net" in Headline type. Links are
700-weight Moss Grey, turning Bark on hover and for the current page, each with a 44px-tall hit area. The signed-in email
sits in a white pill chip, truncated past 16rem. On phones the row wraps rather than
collapsing into a menu. Admins also get **Invites** and **Users**; nobody else sees those links.

The admin **Users** page lists every account newest first as Card Chips: the email in bold
(wrapping anywhere), an **Admin** pill in New Shoot on admin accounts, and a Moss Grey line with
the sign-up time in UTC and how they got in ("Invite from …", "Company email" or "No invite").
The count sits under the heading.

### Undo Toast

A white pill fixed 1.25rem from the bottom with the float shadow. It reads "Done:
{title}" (or "Moved to {pile}: {title}" after a drag) with an **Undo** pill in New Shoot and
Deep Leaf. It disappears after 6 seconds. A failed move shows the same pill as an alert, without
Undo.

### Drag to Move

With a mouse or trackpad (`pointer: fine`) a Card Chip is draggable and shows a grab cursor. The
chip being dragged fades to 40%, and the pile under it gets a 4px Leaf Green ring. A dropped card
moves at once and slots into its pile by age, newest first. Touch screens get no dragging.

## Do's and Don'ts

### Do:

- **Do** keep Leaf Green (`#2f6b4f`) for actions and success only, per the One Green Rule.
- **Do** build depth by layering Garden Ground → pastel → Petal White before reaching
  for a shadow, and use only the Chip and Float shadows.
- **Do** round everything: pills for buttons and badges, 1rem for chips and fields, 1.5rem
  for patches, 1.75rem for the capture surface.
- **Do** keep tap targets at least 44px and keep Moss Grey (`#5e6b61`) as the lightest text
  colour on the ground, to meet WCAG 2.2 AA.
- **Do** give empty and waiting states a warm line of copy and, at most, a small butterfly.
- **Do** wrap decorative motion in `motion-safe` and keep it slow and small (3s, 4px).

### Don't:

- **Don't** add dashboard furniture: charts, priority flags, red notification badges,
  progress rings or dense tables.
- **Don't** style Claude as "AI magic": no glowing gradients, sparkle icons, purple-blue
  shimmer or dark techy panels. Claude appears as a plain sentence in the preview.
- **Don't** go cartoony: no mascots, no bouncy or springy animation, no illustrations
  beyond the single-stroke butterfly.
- **Don't** add a second typeface or set text below 0.875rem.
- **Don't** use pile pastels for anything except piles, or saturate them.
- **Don't** add dark shadows, hard corners or boxed hairline borders around piles.
