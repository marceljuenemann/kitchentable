# Handoff: Kitchen Table Search (discovery, filters, profile, Reach out)

## Overview

The Search tab is the main discovery surface for approved members. It's a 2-column grid of profiles you can filter (Looking for / Gender / Age) and sort. Swipe a tile left to hide that person. Tap a tile to expand it into a full profile with a photo carousel. From there, "Reach out" opens an introduction composer. There's no swiping-to-match: a connection starts with a written introduction.

This builds on the onboarding handoff (`design_handoff_onboarding_flow/`). Every field Search displays is one onboarding collects. **Build the onboarding data model first** and build Search against those real types, not the prototype's mock roster.

## About the design files

`design/Search.dc.html` is a **design reference**, not production code. Open it in a browser with `support.js` beside it. It shows the intended layout, copy and interactions using a hard-coded roster of eight mock people.

## Fidelity

**High-fidelity.** Colours, type, spacing, radii, copy and motion timings are final. Mock data (people, photos, distances) is throwaway.

---

## Shell

Same frame as onboarding: `width: min(600px, 100vw)`, `height: 844px` (`max-height: 100vh`), background `--bg`, column flex, `overflow: hidden`. Layers, bottom to top (z-index):

| z | Layer |
| --- | --- |
| — | Header, grid scroller, bottom nav |
| 35 | Undo snackbar |
| 40 / 50 | Filter sheet scrim / filter sheet |
| 70 | Profile page (scroll container) |
| 80 | Hero photo (animates from tile to full width) |
| 85 | Profile "Reach out" bar |
| 86 | Profile back button |
| 90 / 91 | Reach out scrim / Reach out sheet |

### Header (filter bar)

`--raised`, 1px bottom border `--outline-soft`, padding `12px 16px`. A row with gap 8px:

- A decorative 19px "filter" glyph (three lines of decreasing length) in `--muted`.
- Three filter pills in this order: **Looking for**, **Gender**, **Age**. Each pill is `min-height: 44px`, padding `0 14px`, `border-radius: 99px`, 13.5px weight 700, `white-space: nowrap`, with a 12px chevron (down when closed, up while its sheet is open).
  - Inactive: background `--raised`, text `--ink`, `1.5px solid --outline-soft`.
  - Active (any value set; for Age, any range other than 18–70): background `--violet-container`, text `--violet`, `1.5px solid --violet`.
  - With **2 or more** values picked, a count badge appears after the label: `min-width: 17px`, `height: 17px`, `border-radius: 99px`, background `--violet`, white, 10.5px weight 800.
  - `aria-pressed` reflects active. `aria-label` reads e.g. "Gender, Woman, Trans", "Gender, any", or "Age, 25 to 40".

### Grid area

Scroller: `flex: 1 1 auto; min-height: 0; overflow-y: auto`, scrollbar hidden, padding `14px 16px 96px` (the bottom padding clears the nav).

**Results row** (`margin-bottom: 12px`, baseline, space-between):
- Left: "{n} people found" / "1 person found", 13.5px weight 700 `--muted`.
- Right: sort button with a 15px up/down-arrows icon, 13.5px weight 700 `--violet`. Tapping cycles **Recently active → New here first → Nearest**. The prototype only changes the label; the real one must re-order the query.

**Grid**: `grid-template-columns: repeat(2, minmax(0,1fr))`, **gap 8px**.

**Tile**:
- Wrapper: `position: relative`, `border-radius: 10px`, `overflow: hidden`. Background turns `--magenta` while the tile is being dragged, which is the colour revealed behind it.
- Reveal layer behind the tile: centred column, white, a 26px "eye with slash" icon and "Hide profile" (12.5px weight 800). Its opacity equals the swipe progress.
- Card: `border-radius: 10px`, `--raised`, `touch-action: pan-y`. **Square photo** (`aspect-ratio: 1/1`, `background-size: cover`, a per-photo crop focal point) with a bottom overlay:
  - Gradient `to top`: `oklch(0.16 0.06 300 / .9)` 0% → `/ .64` 46% → `/ 0` 100%, padding `34px 12px 11px`.
  - Name in `--display` 17px weight 700 white, `line-height: 1.15`.
  - Tagline at 12.5px, `line-height: 1.35`, `oklch(0.995 0.004 95 / .95)`, `margin-top: 4px`. Taglines are capped at 60 characters in onboarding precisely so this stays two lines or fewer.
  - **No age on the tile**. Age appears on the expanded profile only.

**Empty state** (no results): a `--cream` card with a `--cream-strong` border, `border-radius: 20px`, padding 20px, centred:
- "Nobody matches all of that" in `--display` 18px weight 700.
- "Try loosening one filter. The list is small on purpose — we don't pad it with people who aren't nearby." in 14.5px `--muted`.
- A "Clear all filters" pill (44px, `--violet`).

### Bottom nav

Absolute, bottom 0, `grid-template-columns: repeat(5, 1fr)`, padding `8px 4px 16px`, background `oklch(1 0 0 / .96)` with `backdrop-filter: blur(10px)`, 1px top border `--outline-soft`.

Items: **Your profile, Search, Likes, Messages, Community**. Each is a 60px-tall button holding a 60×40 pill. Active: pill `--violet-container`, icon `--violet`, stroke 2.4, `aria-current="page"`. Inactive: transparent, `--muted`, stroke 1.9. Icons are 26px stroke icons; Community uses the logo's arc mark at 28px. Icon-only, so each has an `aria-label`.

Only Search is designed. The other four tabs are out of scope.

---

## Swipe to hide

On a tile, using pointer events with pointer capture:

- Drag is **left only**. `dx = clamp(clientX − startX, −160, 0)`.
- Any movement beyond 4px marks the gesture as a drag, so the pointer-up won't also count as a tap.
- While dragging: no transition, tile `translateX(dx)`, tile opacity `1 − progress × 0.25`, reveal opacity `progress`, where `progress = min(1, |dx| / 76)`.
- On release with `|dx| ≥ 76` (**THRESHOLD**): the tile springs back to 0 and, after 180ms, the person is removed from the list and the snackbar shows.
- On release below the threshold: spring back with `transform .22s ease-out, opacity .22s ease-out`.

**Snackbar** (`role="status"`): absolute, `left/right: 16px`, `bottom: 96px` (above the nav), `border-radius: 14px`, background `--ink`, white 14px text, padding `13px 16px`, `--shadow-lift`. Text: "{Name} won't show up again". An **Undo** button on the right (14px weight 800, `oklch(0.86 0.07 90)`) restores the last hidden person. It enters and exits with `opacity .2s, transform .2s` (from `translateY(12px)`) and auto-dismisses after **4 seconds**. Only the most recent hide can be undone.

**Production**: hidden profiles are per-member and permanent, stored server-side, and excluded in the search query. Hiding is private: the other person isn't told. A way to see and un-hide people belongs in settings; it isn't designed yet.

**Accessibility gap**: a swipe isn't reachable by keyboard or screen reader. Add a "Hide" action on the expanded profile, or a context action on the tile, as the accessible equivalent.

---

## Filter sheets

One bottom sheet, content depends on the field. Scrim `oklch(0.29 0.15 300.5 / .4)`, `transition: opacity .3s`, click to close. Sheet: anchored bottom, `border-radius: 32px 32px 0 0`, `--raised`, `--shadow-lift`, padding `16px 20px 24px`, `translateY(110%)` → `0` with `transition: transform .3s ease-out`, `role="dialog" aria-modal="true"`.

- 44×5 grab handle, `--outline-soft`.
- Title row (baseline, space-between): title in `--display` 22px weight 700 `--violet`, plus an **Any** text button (13.5px weight 700 `--muted`) that clears only this field.

**Choice fields (Looking for, Gender)**:
- "Select all" and "Select none" text buttons (13.5px weight 700 `--violet`, gap 14px).
- A stacked list of rows (gap 8px). Each row is `min-height: 48px`, `border-radius: 14px`, padding `0 15px`, 15px weight 700 `--ink`, with a **switch** on the right:
  - Row off: `--raised`, `1.5px solid --outline-soft`. Row on: `--violet-container`, `1.5px solid --violet`.
  - Switch: 44×26 pill, `--input` off / `--violet` on, with a 20px white knob at `left: 3px` off / `21px` on and `--shadow-soft`. Both animate over `.2s`.
  - Use `aria-pressed` on the row and `role="switch"` + `aria-checked` on the switch. (Don't nest an interactive switch inside a button in the real build: make the whole row a single switch.)
- Help text under the list, 13px `--muted`:
  - Looking for: "How someone does relationships right now. It changes, so profiles can say more than one."
  - Gender: "Pick any that apply. People choose their own words for this in their profile — these are the search groupings, not labels we assign."

**Age**:
- Label line: "{min} to {max} years old", or "Any age" at the default.
- Two range inputs, **Youngest** and **Oldest**, both 18–70, step 1, `accent-color: --violet`. The two values can't cross: moving min above max is clamped, and vice versa. Small-caps labels (12px weight 800, `letter-spacing: .1em`).
- A real build should use a single two-thumb range slider.

**Footer** (`margin-top: 20px`, grid `auto minmax(0,1fr)`, gap 10px):
- "Clear all": outlined pill, 52px, resets **every** filter and closes the sheet.
- "Show {n}": `--violet` pill, 52px, closes the sheet. `n` is the live result count, so it updates as options toggle.

Filters apply live. The button only closes the sheet.

### Filter options

These lists **must come from the same shared source as onboarding**:

- **Looking for**: Solo poly, Relationship anarchist, Nesting partner, Open couple, Kitchen table poly, Slow dating, New friends, Don't label it.
- **Gender**: Woman, Man, Non-binary, Trans, Genderqueer, Genderfluid, Agender, Transmasc, Transfem, Questioning.

### Filter logic

- Within a field: **OR**. A person matches if *any* of their values is among the picked ones.
- Across fields: **AND**.
- An empty field means "any".
- Profiles store arrays (`gender: string[]`, `dynamics: string[]`), so the match is set intersection. Someone who chose Woman + Trans matches a filter for Woman, a filter for Trans, and a filter for both.
- Custom (self-described) values never match a filter chip. People who left a field blank aren't excluded unless that filter is active. With Gender filtered, someone with no gender set doesn't appear. That's correct, but worth knowing.
- **Age**: only birth month + year are stored, so derive age as `currentYear − birthYear`, minus 1 if the current month is before the birth month. Do this in the query, not the client. People with no birthday set: decide whether they appear when Age is filtered. Recommendation: no, and the Age row in onboarding is optional, so tell them so when they skip it.
- Never return profiles that aren't approved, are outside London, or are hidden by the viewer.

---

## Profile expansion (FLIP)

Tapping a tile (not a drag) opens the profile.

1. Measure the tile's rect relative to the app frame.
2. Render a **hero layer** at exactly that rect (`border-radius: 10px`) and hide the original tile (`visibility: hidden`) so it doesn't show twice.
3. On the next frame, animate the hero to `left: 0; top: 0; width: 100%; height: {frame width}px` (a full-width square) with `border-radius: 0`.
   Transition: `left, top, width, height, border-radius` all `.34s cubic-bezier(.22,.68,.16,1)`.
4. At the same time, fade the profile page in (`opacity .18s`). Its content fades in staggered: header `.2s` delay `.16s`, meta `.18s`, chips `.22s`, About me `.24s`, Looking for `.26s`. The back button fades at `.12s` and the Reach out bar at `.2s`.

Closing reverses it: the hero returns to the tile's rect, and after **340ms** the profile unmounts and the tile becomes visible again. Guard against fast open-close-open sequences with a token, as the prototype does.

While the profile scrolls, the hero is shifted up with it (`translateY(−scrollTop)`), so it behaves like part of the page. The real build can put the photo inside the scroll container once the open animation ends, which is simpler.

**Implementation advice**: this is the riskiest piece. Ship a simple slide or fade first in its own PR, then add the shared-element animation (View Transitions API, Framer Motion `layoutId`, or a hand-rolled FLIP). Respect `prefers-reduced-motion` by skipping the morph.

### Profile page

A full-frame scroll container (`--bg`), bottom padding 104px for the action bar. A square spacer at the top reserves room for the hero photo.

**Photo carousel** (inside the hero):
- A horizontal track of the person's photos. Drag with pointer events (`touch-action: pan-y`). Release past **48px** moves one photo. No wraparound.
- Settle transition `transform .28s cubic-bezier(.22,.68,.16,1)`, none while dragging.
- Dots: centred 12px from the bottom, gap 6px, 6px tall. The current dot is 18px wide in solid white; the others are 6px wide at `/ .55` white. Each has a small shadow. Width and colour animate over `.2s`.
- Main photo first (index 0 from onboarding). Supports 1–6 photos; the prototype hard-codes 3. Hide the dots if there's only one photo.
- Add keyboard and screen-reader support: previous/next buttons, or arrow keys with a live "Photo 2 of 4".

**Back button**: top-left at 12px, 44×44 circle, `oklch(1 0 0 / .92)` with `blur(8px)`, `--violet` chevron, `--shadow-soft`, `aria-label="Back to search"`.

**Content** (`padding: 20px 20px 0`):
- `h1`: "{Name}, {age}" in `--display` 28px weight 700 `--violet`, `line-height: 1.1`.
- Meta line (`margin-top: 8px`, 14.5px weight 700 `--muted`): pronouns · a 15px map pin + **London**.
- Chips (`margin-top: 16px`, gap 8px). Pills with padding `8px 13px`, 13.5px weight 700:
  - Gender values, tinted: Woman `--magenta-container` / `--magenta`; Man `--sky-container` / `--sky`; Non-binary and Agender `--violet-container` / `--violet-soft`; Trans `--gold-container` / `--gold`; anything else `--sunken` / `--muted`.
  - Sexuality values in `--gold-container` / `--gold`.
  - Render **one chip per value**. Profiles have arrays. Skip the chips for blank fields.
- **About me**: `h2` in `--display` 19px weight 700, an underline bar (36×3, `--gold`, `margin-top: 8px`), then the text at 17px, `line-height: 1.65`, `margin-top: 14px`. Split on blank lines into paragraphs.
- **Looking for**: same heading with a `--violet` bar, then a list (gap 10px) of an 8px `--violet` dot and the value at 16px `line-height: 1.55`.

**Reach out bar**: absolute bottom, padding `14px 20px 20px`, `oklch(1 0 0 / .96)` + `blur(10px)`, 1px top border. A full-width 52px `--violet` pill with a 20px gold heart (`#E3AF47`) and "Reach out".

Not shown on a profile: email, exact birthday, vetting answers, distance. The grid's mock data had distances; the design deliberately leaves them out. Sort by "Nearest" can still use location server-side.

---

## Reach out sheet

Same sheet chrome as the filters: scrim and sheet at z 90/91, `max-height: 82%`, column flex with a scrollable middle.

- Header: grab handle and "Reach out to {Name}" (`--display` 22px weight 700 `--violet`).
- **WHAT TO MATCH ON** (12px weight 800, `letter-spacing: .1em`, uppercase, `--muted`): one switch row per value in *their* Looking for list, styled like the filter rows. These are optional and tell the recipient which of their dynamics you're writing about. The selection is remembered per profile while the sheet reopens; it resets when you open someone else.
- **YOUR MESSAGE**: textarea, 5 rows, `border-radius: 16px`, 16px / `line-height: 1.55`, `resize: none`. Placeholder: "Say what made you want to write, and something specific about them."
- Footer (1px top border, padding `12px 20px 20px`): full-width 52px pill.
  - Under **20 characters**: disabled (`--outline-soft`), label **"Write a little more"**.
  - At 20 or more: `--violet`, label **"Send introduction"**.
  - No maximum length.
- Sending closes the sheet and clears the message.

**Production**: sending creates an introduction record (sender, recipient, message, matched-on values, timestamp). It shows up in the recipient's Likes tab, which isn't designed yet. Decide before building:
- Can you reach out to the same person twice? Recommendation: one pending introduction per pair.
- Should the Reach out button change state after sending (e.g. "Introduction sent")? It isn't designed; it should.
- Rate limits for introductions per day.
- Show a confirmation after sending. The prototype has none; reuse the snackbar ("Introduction sent to {Name}").

---

## Data the screen needs

Per profile in the grid: `id`, `name`, `tagline`, `photos[0]` (+ crop focal point if you support one).
Per expanded profile: also `pronouns`, `age` (derived), `gender[]`, `sexuality[]`, `aboutText`, `dynamics[]`, `photos[]`.
Per viewer: `hiddenProfileIds`, current filters and sort (persisting them between visits is a nice-to-have).

Suggested tables (Supabase):
- `profiles`: the onboarding fields, plus `status` (`pending` / `approved` / `rejected`), `last_active_at`, `approved_at`.
- `hidden_profiles (viewer_id, hidden_id, created_at)`.
- `introductions (id, sender_id, recipient_id, message, matched_on text[], created_at, status)`.

Sorts map to: **Recently active** → `last_active_at desc`; **New here first** → `approved_at desc`; **Nearest** → distance from the viewer's area. London-only, so this needs a borough or postcode district on the profile. Onboarding doesn't collect one yet.

## Prototype divergences (follow the README, not the prototype)

1. **Looking for includes "Something else"** in Search's list. Onboarding dropped it in favour of self-describe. Remove it here too.
2. **Mock genders "Trans woman" and "Trans man"** (Rowan, Nour) no longer exist as options, so these two never match a Gender filter. In real data they'd be `["Woman", "Trans"]` and `["Man", "Trans"]`.
3. **Mock profiles have single-value `gender`, `sexuality` and `dynamic`** fields used for filtering, and show one gender and one sexuality chip. Real profiles have arrays: use set intersection and render a chip per value.
4. **Location "London"** is hard-coded on the profile, and mock profiles carry distance strings that aren't shown. Use the real location field.
5. **The carousel assumes exactly three photos.** Support 1–6.
6. **Photos load from an external avatar service.** That's mock data only.
7. **Sort only changes its label**, and **Send introduction only closes the sheet**. Both need real behaviour.
8. **Only the Search tab works.** The others are placeholders.

## Design tokens

Identical to the onboarding handoff and already in `src/styles.css`:

```
--violet            oklch(0.29 0.15 300.5)
--violet-soft       oklch(0.42 0.19 300)
--violet-container  oklch(0.925 0.032 300)
--sky               oklch(0.48 0.12 233)
--sky-container     oklch(0.925 0.043 233)
--magenta           oklch(0.5 0.216 341)
--magenta-container oklch(0.935 0.038 341)
--gold              oklch(0.48 0.12 68)
--gold-container    oklch(0.935 0.05 84)
--bg                oklch(0.995 0.004 95)
--ink               oklch(0.21 0.095 300)
--muted             oklch(0.42 0.045 300)
--raised            oklch(1 0 0)
--sunken            oklch(0.958 0.008 95)
--cream             oklch(0.955 0.032 88)
--cream-strong      oklch(0.925 0.048 86)
--outline           oklch(0.55 0.03 300)
--outline-soft      oklch(0.885 0.012 95)
--input             oklch(0.855 0.016 95)
--shadow-soft       0 1px 2px oklch(0.3 0.12 300 / .07), 0 10px 26px -14px oklch(0.3 0.12 300 / .22)
--shadow-lift       0 2px 6px oklch(0.3 0.12 300 / .1), 0 22px 46px -20px oklch(0.3 0.12 300 / .3)
```

Type: display `"Baloo Bhaijaan 2"`, body `"Nunito Sans"`.
Radii: 10 (tiles), 14 (rows, snackbar), 16 (message field), 20 (empty state), 32 32 0 0 (sheets), 99 (pills, switches, nav pills, dots).
Easing: `cubic-bezier(.22,.68,.16,1)` for the morph and the carousel; `ease-out` for sheets and swipe spring-back.
Minimum hit target 44px.

## Suggested build order

Assumes the onboarding data model and shared option lists exist.

1. **Query + grid**: approved, London, not hidden, with sort. Results line, empty state, bottom nav shell.
2. **Filter sheets**: shared sheet component, switch rows, age range, live counts, OR/AND logic in the query.
3. **Swipe to hide**: gesture, snackbar with undo, the `hidden_profiles` table, plus the accessible Hide action.
4. **Profile page**: a plain transition first, with the carousel, chips and content.
5. **Shared-element morph**: a separate PR, behind reduced-motion.
6. **Reach out**: sheet, validation, the `introductions` table, the sent state and confirmation.

## Files in this bundle

| File | What it is |
| --- | --- |
| `design/Search.dc.html` | The Search prototype. Open in a browser to try it |
| `design/Kitchen Table Design System.dc.html` | Token reference and component inventory |
| `design/support.js` | Runtime needed to open the HTML files locally |

## Out of scope

Likes, Messages, Community and Your profile tabs; the recipient's view of an introduction; reporting and blocking (needed before launch, and the profile page is where it would live); un-hiding people; saved filters.
