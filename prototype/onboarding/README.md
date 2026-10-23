# Handoff: Kitchen Table onboarding & application flow

## Overview

Kitchen Table is a non-profit, community-run ENM (ethical non-monogamy) dating app, launching in London. This package covers the **signup and application flow**: the landing page, account creation, the four profile-building steps, and the "application received" confirmation.

Membership is gated. Anyone arriving with an invite code can apply; a volunteer then reads the application and approves or rejects it. Age verification (a provider-based check) happens **after** approval and is **not** part of this flow.

## About the design files

`design/Onboarding.dc.html` is a **design reference**, not production code. It is a self-contained HTML prototype that runs in a browser (open it directly — `support.js` must sit beside it) and demonstrates the intended layout, copy, validation and interaction behaviour.

Do **not** port this file into the app. Recreate these screens in the existing codebase — its framework, its component primitives, its token file — using the prototype as the spec for look and behaviour. Where this document and the prototype disagree, this document wins.

Target codebase: this repo's `web/` (Angular standalone components + Angular Material — see `CLAUDE.md`). Recreate these screens using the project's existing components, styles and conventions rather than re-deriving anything from the prototype's inline styles.

## Fidelity

**High-fidelity.** Colours, typography, spacing, radii, copy and validation rules are final and should be matched. The two deliberate exceptions, both marked in the UI:

1. **Photo picker** — the prototype fills tiles with generated placeholder graphics. Real implementation needs a device photo picker and upload.
2. **Email verification** — the prototype shows a "Don't check your inbox yet" panel with a button that skips ahead. Real implementation sends a magic link and resumes from the link.

---

## Flow structure

| index | `STEPS` name | Screen title | Counted in stepper |
| --- | --- | --- | --- |
| 0 | Account | (landing page + Sign Up card) | no |
| 1 | Create profile | Create profile | Step 1 of 4 |
| 2 | About you | About you | Step 2 of 4 |
| 3 | Add photos | Add photos | Step 3 of 4 |
| 4 | Consent | Vetting | Step 4 of 4 |
| — | — | Your application is being reviewed | no |

`APPLY_STEPS = 4`. The account step is not counted as a profile step.

### Shell

Fixed app frame: `width: min(600px, 100vw)`, `height: 844px` (`max-height: 100vh`), background `--bg`, `overflow: hidden`, column flex. In the real app this is the phone viewport; the 600px cap is a prototype convenience for desktop viewing.

**Header** (`showStepper`: visible on steps 1–4, hidden on the landing page and the confirmation screen):
- Background `--raised`, padding `14px 16px 12px`, column flex, gap 12px.
- Row 1: centred logo mark (30×30) + wordmark "KITCHEN TABLE" — `--display`, 14px, weight 800, `letter-spacing: .15em`, uppercase, `--violet`.
- Row 2: back button (44×44 circle, `--sunken` fill, `--violet` chevron, `aria-label="Back"`; shown only when `step > 1`) then the progress bar.
- Progress bar: 6px tall, full-width, `--outline-soft` track, `--violet` fill, `border-radius: 99px`, `transition: width .3s ease-out`.
- **Progress is `step / 4`** — 25% on step 1, 100% on step 4. It counts completed steps, so step 1 is never empty.

**Content area**: `flex: 1 1 auto; min-height: 0; overflow-y: auto`, scrollbar hidden, background `--raised`, padding `0 24px 24px` on step 0 and `8px 24px 24px` on every other step. **On every step change the content area must scroll back to the top.**

**Footer** (visible on steps 1–4 and the confirmation screen; not on the landing page):
- `margin-top: 34px; padding-top: 18px`, 1px top border `--outline-soft`, centred wrap row, `gap: 6px 14px`.
- Line 1 (full width, centred): "Signed in as **{email}**" (13px, `--muted`, the address in weight 700 `--ink`) with a **Sign out** button inline after it (13px, weight 700, `--violet`).
- Line 2: Contact · Terms & Conditions · Privacy Policy — 13px, weight 600, `--muted`, no underline.
- Sign out clears the saved draft and returns to the landing page. *In production, keep the draft server-side and restore it on next sign-in.*
- The "Prototype: back to start" link is prototype-only — drop it.

### Step eyebrow + title (steps 1–4)

- Eyebrow: "Step N of 4" — 11.5px, weight 800, `letter-spacing: .14em`, uppercase, `--magenta`, `margin: 18px 0 0`.
- Title: `--display`, 26px, weight 700, `--violet`, `margin: 6px 0 0`.
- Optional subtitle under it: 15px, `line-height: 1.5`, `--muted`.

### Primary button (used on every step)

Full width, `height: 52px`, `border-radius: 99px`, no border, 16.5px weight 700, label colour `oklch(0.995 0.004 95)`. Enabled background `--violet`; disabled background `--outline-soft` with `cursor: not-allowed`. Buttons are **disabled, not hidden**, until their step's gate passes.

---

## Screen 0 — Landing page + Sign Up

Content is capped at `max-width: 430px`, centred.

**Masthead**: logo mark 60×60 + wordmark (23px, weight 800, `letter-spacing: .07em`, uppercase, `--violet`), gap 13px, `padding-top: 40px`.

**Headline**: "ENM dating, reimagined." — `--display`, 42px, weight 800, `line-height: 1.03`, `letter-spacing: -.02em`, `--violet`, `text-wrap: balance`, `margin-top: 34px`.

**Subhead**: "Kitchen Table is a new dating community for non-monogamous folks in London." — 17.5px, `line-height: 1.5`, `--muted`, `margin-top: 16px`.

**Three bullets** (`margin-top: 26px`, column gap 13px). Each is a 2-column grid (`auto minmax(0,1fr)`, gap 12px): a 9×9 coloured dot (`margin-top: 7px`) and 15.5px text at `line-height: 1.5`, bold lead-in:

| Dot | Copy |
| --- | --- |
| `--sky` | **Non-profit.** No need to pay just to see who likes you |
| `--magenta` | **Invite-only.** Building a trusted community, one vetted member at a time |
| `--gold` | **Community-driven.** Help shape the guidelines, the features, even the code |

**Sign Up card** (`margin: 28px 0 8px`, `border-radius: 24px`, 1px `--outline-soft`, background `--bg`, padding `24px 20px`):
- Heading "Sign up" — `--display`, 20px, weight 700, `--violet`.
- Field label "EMAIL" — 12.5px, weight 800, `letter-spacing: .08em`, uppercase, `--muted`.
- Email input — `height: 52px`, `border-radius: 14px`, 1px `--input`, background `--bg`, padding `0 16px`, 16px text. Placeholder `you@example.com`.
- Consent checkbox — 24×24, `border-radius: 8px`, 2px border (`--outline` off, `--violet` on), fill `--raised` off / `--violet` on, white tick when checked. `role="checkbox"`, `aria-checked`. Label text: "I agree to the [Terms] and [Privacy Policy]." at 14.5px — the plain text toggles the box, the two links navigate.
- Primary button "Sign up".

**Gate**: email matches `/\S+@\S+\.\S+/` **and** the checkbox is ticked.

**After "Sign up"** the card is replaced (same position/size) by a confirmation panel: `border-radius: 24px`, 1px `--cream-strong`, background `--cream`, padding `24px 20px`.
- Row: 38×38 circle `--raised` containing a 20px envelope icon in `--violet`, gap 12px, then heading "Don't check your inbox yet" — `--display`, 20px, weight 700, `--violet`.
- Body, 15px `--ink`: "In the real implementation an email would be sent to **{email}** at this point. For now, just click the button below to carry on."
- Primary button "Continue the flow" → step 1.
- Text button below, centred: "Use a different email" — 13px, weight 600, `--muted`, underlined → back to the Sign Up card.

**Production behaviour**: send a magic link, show a genuine "check your inbox" state (with resend + cooldown), and resume the flow when the link is opened. The invite code arrives in the URL and must be validated before the form is usable.

---

## Screen 1 — Create profile

**Name** — label "NAME", text input (same input spec as above), placeholder "What should people call you?".

**Four disclosure rows** (`margin-top: 20px`, column gap 8px). Each is a full-width button, `min-height: 56px`, `border-radius: 14px`, padding `10px 16px`, space-between, with a right chevron (18px, `--muted`):
- Left column: the field label at 12px, weight 800, `letter-spacing: .06em`, uppercase, `--muted`, followed by a suffix in weight 600 / no letter-spacing / `opacity: .7` — " · required" for Preferred pronouns, " · optional" for the rest. Below it, the current value at 15.5px weight 700, `line-height: 1.35`.
- Unset: background `--raised`, border `1.5px solid --outline-soft`, value text `--muted`, showing the empty-state string.
- Set: background `--violet-container`, border `1.5px solid --violet`, value text `--ink`, showing the selections joined with ", ".

| Key | Label | Empty state | Mode |
| --- | --- | --- | --- |
| `pronouns` | Preferred pronouns | Add pronouns | **single-select, required** |
| `gender` | Gender | Add gender | multi-select, optional |
| `sexuality` | Sexuality | Add sexuality | multi-select, optional |
| `age` | Age | Add birthday | month + year, optional |

**Location** — label "LOCATION", then two equal-width radio buttons in a row (gap 8px): "London" and "Somewhere else". Each `flex: 1 1 0`, `min-height: 52px`, `border-radius: 14px`, 15.5px weight 700, with a 20px ring (2px border) containing a 10px dot. Unselected: background `--raised`, border `1.5px --outline-soft`, ring `--input`, dot transparent. Selected: background `--violet-container`, border and ring and dot `--violet`, text `--violet`.

When "Somewhere else" is selected, two things appear:
1. A warning card — `border-radius: 16px`, 1px `--cream-strong`, background `--cream`, padding `15px 16px`, 2-col grid with a 20px `--gold` warning triangle: "**We've only launched in London so far.** Leave your city and we'll email you when Kitchen Table opens where you are — you won't appear in search until then."
2. A "WHERE ARE YOU?" text input, placeholder "e.g. Manchester, Berlin".

**Gate**: name is non-empty **and** at least one pronoun is set **and** (location is London **or** the other-city field is non-empty).

### Bottom sheet (shared by the four disclosure rows)

Scrim: `position: absolute; inset: 0`, `oklch(0.29 0.15 300.5 / .4)`, `transition: opacity .3s`, click to dismiss.

Sheet: anchored bottom, `max-height: 84%`, `border-radius: 32px 32px 0 0`, background `--raised`, `--shadow-lift`, `transform: translateY(110%)` → `translateY(0)`, `transition: transform .3s ease-out`.

- Header (`padding: 16px 20px 0`): 44×5 grab handle in `--outline-soft`, centred. Then a baseline-aligned row: title (`--display`, 22px, weight 700, `--violet`) and a "Clear" text button (13.5px weight 700 `--muted`) — **Clear is hidden for single-select**. Below, help text at 14px `--muted`.
- Body: scrollable, padding `16px 20px`.
- Footer: a full-width "Done" primary button with a 1px `--outline-soft` top border — **hidden for single-select**, which closes on pick.

| Field | Title | Help text | Self-describe placeholder |
| --- | --- | --- | --- |
| pronouns | Preferred pronouns | Pick one, or add your own. | e.g. ze/hir |
| gender | Gender | Pick any that apply, or add your own. Shown on your profile. | e.g. genderfluid, bigender |
| sexuality | Sexuality | Pick any that apply, or add your own. | e.g. sapphic, achillean |
| age | When were you born? | We show your age on your profile, never your birthday. | — |

**Single-select body (pronouns)**: stacked rows, `min-height: 52px`, `border-radius: 14px`, 15.5px weight 700, each with a 20px radio ring + 10px dot, same on/off colours as the location buttons. `role="radio"`, `aria-checked`. **Picking an option sets the value and closes the sheet immediately.**
Options: `she/her`, `he/him`, `they/them`, `she/they`, `he/they`, `any pronouns`.

**Multi-select body (gender, sexuality)**: wrapping chips, `min-height: 44px`, `border-radius: 99px`, padding `0 15px`, 14px weight 700, gap 7px. Off: background `--sunken`, text `--muted`, `2px solid transparent`. On: background `--violet-container`, text `--violet`, `2px solid --violet`, and a 13px tick **rendered only when selected** (do not reserve its width when off). `aria-pressed`.
- Gender: Woman, Man, Non-binary, Agender, Genderfluid, Genderqueer, Trans woman, Trans man, Transmasculine, Transfeminine, Intersex, Questioning.
- Sexuality: Queer, Bisexual, Pansexual, Lesbian, Gay, Straight, Asexual, Demisexual, Aromantic, Omnisexual, Questioning.

**Self-describe row** (all choice sheets): heading "IN YOUR OWN WORDS" (12px, weight 800, `letter-spacing: .1em`, uppercase, `--muted`, `margin-top: 22px`), then a 50px input + an "Add" pill button (`height: 50px`, padding `0 18px`, `--violet` enabled / `--outline-soft` disabled). Add is disabled when the draft is empty or duplicates an existing selection. A custom value is appended to the option list and shown selected. On a single-select sheet, adding a custom value also closes the sheet.

**Age body**: a Month `<select>` (flex, label "MONTH") and a Year `<select>` (fixed 130px, label "YEAR"), gap 10px, both 52px tall with the standard input styling. Year list runs from `currentYear − 18` back 73 years. Below, an echo line at 15px weight 700: "That makes you {n}." in `--violet`, or "Pick a month and year." in `--muted`.
Age is computed as `currentYear − year`, minus 1 if the current month is before the birth month. **Day of birth is deliberately not collected.** Store month + year for the 18+ check; display only the derived age.

---

## Screen 2 — About you

**Tagline** — label "TAGLINE", text input `maxlength="60"`, placeholder "One line summary that people see first". Right-aligned counter below at 11px weight 600 `--outline`: "{60 − length} left". **Optional.**

**About you** — label "ABOUT YOU", `<textarea rows="7">` (`border-radius: 14px`, padding `14px 16px`, 16px / `line-height: 1.55`, `resize: vertical`), placeholder "Tell people more about yourself and what you're looking for". Right-aligned counter at 12px weight 600: below the minimum it reads "{n} characters to go" in `--magenta`; at or above it reads "{n} characters" in `--outline`. **Required, minimum 250 characters (trimmed).**

**Looking for** — label "LOOKING FOR", then wrapping chips (`min-height: 44px`, `border-radius: 99px`, padding `0 15px`, 14.5px weight 700, gap 8px). Off: `--sunken` / `--muted` / `1.5px solid transparent`. On: `--violet-container` / `--violet` / `1.5px solid --violet` plus a 15px tick, again **rendered only when on**.

Default options (these are the same values the Search filter uses — keep the two lists in sync, ideally from one source):
`Solo poly`, `Relationship anarchist`, `Nesting partner`, `Open couple`, `Kitchen table poly`, `Slow dating`, `New friends`, `Don't label it`.

Below the chips, an "Add your own" row: pill input (`height: 48px`, `border-radius: 99px`, padding `0 18px`) + "Add" pill button. Enter submits. Add is disabled when empty or a case-insensitive duplicate. Custom values are appended to the chip list, selected.

**Gate**: about text ≥ 250 characters **and** at least one "Looking for" value.

---

## Screen 3 — Add photos

Subtitle: "Select up to six photos. Drag to reorder."

**Grid**: `grid-template-columns: repeat(3, minmax(0,1fr))`, gap 8px, each tile `aspect-ratio: 1`, `border-radius: 14px`, `overflow: hidden`. **The first tile spans `grid-area: 1 / 1 / 3 / 3`** (2×2), so the layout is one large tile plus two stacked on the right in rows 1–2, and three across row 3.

- **Empty tile**: `1.5px dashed --input`, background `--sunken`, centred column with a 22px `--violet` plus icon and a 12px weight 700 `--muted` label — "Main photo" on tile 1, "Add photo" on the rest.
- **Filled tile**: the photo, `object-fit: cover`. Tile 1 carries a "MAIN" badge bottom-left (padding `5px 10px`, `border-radius: 99px`, background `--violet`, white text, 11px weight 800, `letter-spacing: .08em`, uppercase). Every filled tile has a remove button top-right: 30×30 circle, `oklch(0.22 0.03 300 / .62)`, white 15px ✕, `aria-label="Remove photo N"`.
- **Reorder**: filled tiles are draggable; dragging over another index moves the dragged photo to that index (splice out, splice in). The dragged tile renders at `opacity: .45`. **The prototype uses HTML5 drag events, which do not work on touch** — implement with pointer events or a touch-capable library so it works on a phone.
- Photos always fill from the start of the array; index 0 is the main photo. Removing an item shifts the rest up.

**Notice card** (`--cream` / `--cream-strong`, same shape as the location warning): "**Photo picker not yet implemented.** Tapping a square drops in a sample picture so the rest of the flow can be tried out." — **prototype-only, remove it**. Replace tap-to-fill with a real picker + upload (crop to square, size/type limits, progress and failure states).

**Empty-state line** (only while zero photos): "Add at least one photo to continue." — 13.5px weight 700 `--magenta`.

**Gate**: at least one photo.

---

## Screen 4 — Vetting

Subtitle: "These answers are not shown on your profile."

Two questions, each a 16.5px weight 700 `--ink` prompt (`line-height: 1.4`, `margin-top: 22px`) over a `<textarea rows="4">` with placeholder "Write as much or as little as you need", and the same counter treatment as the About field.

1. "In your own words, what is consent and why is it important?" — minimum **80** characters.
2. "What guidelines do you think everyone in the Kitchen Table community should adhere to?" — minimum **80** characters.

Primary button: **"Submit application"**. Gate: both answers meet their minimums.

These answers are private: visible to reviewing volunteers only, never rendered on a profile or returned by any member-facing endpoint.

---

## Screen 5 — Application received

No header, no stepper. `padding-top: 40px`.

- Masthead: 60×60 logo + "KITCHEN TABLE" wordmark (same as the landing page).
- `margin-top: 38px`: a row (gap 14px) of a 46×46 `--violet-container` circle holding a 24px `--violet` checkmark, and the heading "Your application is being reviewed" — `--display`, 24px, weight 700, `line-height: 1.2`, `--violet`.
- Body, 16px `--ink`, `margin-top: 16px`: "You will be emailed once your application has been reviewed."
- Footer (sign-out + legal links) is shown.

This is where the user waits. On approval the app sends them to age verification, which is outside this flow.

---

## State model

The prototype persists a draft to `localStorage` under `kt_onboarding_draft` on every change. **In production this should be a server-side draft** (a row per applicant, upserted as they go) so the flow survives a device change and a magic-link round trip.

| Field | Type | Notes |
| --- | --- | --- |
| `step` | int 0–4 | current step |
| `email` | string | validated `/\S+@\S+\.\S+/` |
| `agree` | bool | terms + privacy |
| `name` | string | required |
| `pronouns` | string[] | exactly one entry; required |
| `gender` | string[] | optional |
| `sexuality` | string[] | optional |
| `location` | `"London" \| "Somewhere else"` | default `"London"` |
| `locationOther` | string | required when location is "Somewhere else" |
| `birthMonth` | string `"1"`–`"12"` | optional |
| `birthYear` | string | optional |
| `tagline` | string ≤ 60 | optional |
| `aboutText` | string ≥ 250 | required |
| `dynamics` | string[] | ≥ 1 required; free values allowed |
| `photos` | string[] ≤ 6 | ordered; index 0 is the main photo |
| `vetConsent` | string ≥ 80 | private |
| `vetWhy` | string ≥ 80 | private |
| `submitted` | bool | locks the flow to the confirmation screen |

Transient (not persisted): `sheet` (which bottom sheet is open), `customDraft`, `dynamicDraft`, `dragIndex`, `emailSent`.

The prototype logs `onboarding_step_view`, `onboarding_field_change` and `magic_link_sent` to the console — wire these to the real analytics sink, and **never send the free-text field values**.

## Design tokens

Already present in `src/styles.css` — use the existing variables, listed here only so the spec is readable standalone.

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

**Type**: display `"Baloo Bhaijaan 2"` (weights 500–800), body `"Nunito Sans"` (400/600/700 + italic 400).

Sizes in use: 42 / 26 / 24 / 23 / 22 / 20 / 17.5 / 16.5 / 16 / 15.5 / 15 / 14.5 / 14 / 13.5 / 13 / 12.5 / 12 / 11.5 / 11 px.

**Radii**: 8 (checkbox), 14 (inputs, tiles, rows), 16 (notice cards), 24 (sign-up card), 32 32 0 0 (bottom sheet), 99 (pills, chips, buttons, progress bar).

**Motion**: sheet `transform .3s ease-out`; scrim `opacity .3s`; progress `width .3s ease-out`. Nothing else animates.

**Minimum hit target**: 44px. Chips are `min-height: 44px`, rows 52–56px, buttons 52px.

## Accessibility notes carried in the prototype

- Checkbox is `role="checkbox"` + `aria-checked`; radio rows `role="radio"` + `aria-checked`; chips use `aria-pressed`.
- The bottom sheet is `role="dialog" aria-modal="true"` with an `aria-label` matching its title. **The prototype does not trap focus or handle Escape — add both.**
- Every icon-only control has an `aria-label`; decorative SVGs are `aria-hidden`.
- Selection is never signalled by colour alone (ticks, dots, borders all change).

## Assets

- **Logo**: inline SVG in the prototype — five arcs plus a centre ring, with a gold heart on the large lockup. Colours `#3B176F`, `#70C4EC`, `#C83897`, `#E3AF47`, `#6C3AB2`. Use the existing `src/components/kt/logo.tsx` instead.
- **Icons**: inline 24×24 stroke SVGs (chevron, back, plus, close, tick, envelope, warning triangle), stroke widths 2.2–3, round caps and joins. Substitute the codebase's icon set if one exists.
- **Photos**: none real. The prototype generates six tinted placeholder graphics; they are throwaway.

## Files in this bundle

| File | What it is |
| --- | --- |
| `design/Onboarding.dc.html` | The full flow prototype — open in a browser to click through it |
| `design/Kitchen Table Design System.dc.html` | Token reference, component inventory, Material 3 role mapping |
| `design/support.js` | Runtime needed to open the two HTML files locally |

## Suggested build order

1. **Data model first** — the draft table, types, and save/restore. Every screen is then a form over an existing model.
2. **Shell** — routing, the header/stepper, scroll-to-top on step change, the footer.
3. **Step 0** — landing page + real magic-link signup + invite-code validation.
4. **Step 1** — name, location, and the bottom sheet, which is the most reusable piece here.
5. **Step 2** — the three fields and their validation.
6. **Step 3** — photo picker, upload, and touch-capable reordering. The largest unknown; budget accordingly.
7. **Step 4 + confirmation** — two textareas, submit, and the review state.

Steps 3 and 4 both touch the review pipeline (a volunteer needs to see photos and answers together) — worth designing that queue before building either.

## Known gaps, deliberately out of scope

- Age verification after approval (provider check, ID fallback, appeal path).
- The approval/rejection emails and the rejected state in-app.
- Profile editing after onboarding.
- Invite-code issuance and tracking.
- What a "Somewhere else" applicant sees after approval.
