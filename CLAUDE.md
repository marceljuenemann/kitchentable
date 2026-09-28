# Kitchen Table

Open-source, non-profit dating app for London's ENM (ethically non-monogamous) community. Self-funded, run via the founder's Ltd for now, with a possible future CIC if it expands beyond London ENM.

Full product context — mission, principles, business model, MVP scope — lives in [PRODUCT.md](PRODUCT.md). Read it before making product decisions.

## Tech stack

- **Backend:** Supabase (Postgres, Auth via magic link, Storage). Schema/migrations in `supabase/migrations/`, pgTAP tests in `supabase/tests/database/`. Clients access `profiles` only through stored procedures, not tables/RLS — see [docs/database.md](docs/database.md) (profile statuses, transitions, access rules); keep it updated with schema changes. Photo handling (sizes, storage layout, privacy) is in [docs/photos.md](docs/photos.md).
- **Frontend:** Angular (standalone components + signals, no NgModules) + Angular Material, in `web/`. No custom branding/theme yet — stock Material. A Material 3 theme + brand palette (violet/magenta/gold/sky, "Baloo Bhaijaan 2" + "Nunito Sans") is specced but not yet implemented — see `prototype/onboarding/`.
- **Local dev:** see [README.md](README.md) for setup. `supabase start` for the backend, `ng serve` for the frontend, Mailpit for magic-link emails. Keep both `supabase start` and `ng serve` running in the background rather than starting/stopping them per task — the user keeps them running too and is happy to share the same instance to preview changes live.

## Status

Sign-up (invite code + magic link) and sign-in are built. Signed-in users land on `/app`, a shell that shows a screen based on their profile status: no profile row → onboarding, `vetting` → "being vetted", `approved` → age verification, `active`/`disabled` → main app. Each screen includes the shared `app-header`/`app-footer` components as needed (the main app won't use the footer). Onboarding has its infrastructure (draft store, stepper) and steps 1 ("Create profile"), 2 ("About you") and 3 ("Add photos": picking, cropping, upload to the `photos` bucket, display from storage, and drag-to-reorder with the first photo as the main one) and 4 ("Vetting": two private questions, 80 characters minimum each; the answers live in the draft as `vettingAnswers`, and "Submit application" does nothing yet) built. Age verification and the main app are placeholders. The onboarding draft lives in localStorage via `UserStorage` (`core/user-storage.ts`: keys scoped to the user id, survives session expiry, cleared only on explicit sign-out: whatever signs the user out must call `UserStorage.onSignOut()` first), and a profile row is created only on submission. Admin review is manual for now (flip `status` in Supabase Studio).

Not built yet: submission (`submit_onboarding`) and the confirmation screen after it, age verification, browse, connections/intros, messaging (planned to use RxDB for offline-tolerant messaging specifically — see conversation history / PRODUCT.md for why). See [TODO.md](TODO.md) for known gaps.

## Working with the user

- **Edit files with the Edit/Write tools**, not through Bash (sed, Python, heredocs). They need no approval and are easier to review. This includes multi-file changes: do them one file at a time.
- **Don't commit or push unless asked.** Leave `TODO.md` untouched unless asked to change it.
- **Don't stop or restart the user's dev servers** (`supabase start`, `ng serve`). If a restart is really needed (for example Vite's "Outdated Optimize Dep" 504 after installing a dependency), ask the user to do it.
- **Keep docs current in the same change:** update `docs/database.md`, `docs/photos.md` and this file when behaviour, schema or conventions change. Check plans and docs for stale numbers or wording before presenting them.
- **Nothing is deployed yet, so migrations are rewritten in place** (clean slate) rather than stacking new ones. Revisit this once there is a deployed database.
- **Plan before big or unclear work.** When asked to plan ("just planning, no coding"), don't write code. Give a recommendation with the reasoning rather than a survey of options. Don't claim things about the code or database without checking (query the DB, read the file).
- **Keep it lean:** prefer the smallest thing that works (few stored procedures, no speculative columns, no extra tables). The user reviews the Supabase and security-relevant code closely, so keep that part small and clear.
- **Report honestly:** say what was verified and how (unit, e2e, screenshots) and what wasn't (for example real-phone touch).

## Frontend conventions

- **Look and feel is iterated with the user in small steps.** Match the existing look (brand fonts, colours, chips, sheets) and keep styles consistent across screens. Put repeated styling (labels, placeholders, chips, textareas) in `web/src/styles.scss` as global styles instead of per-component copies.
- **Pickers are bottom sheets** (`MatBottomSheet`, panelClass `kt-bottom-sheet`), not dialogs. Use `autoFocus: 'dialog'` so no button is focused on open.
- **Form fields:** `floatLabel="always"` with a visible placeholder. Colours follow the theme tokens (`--mat-sys-*`, `--kt-*`) rather than hard-coded values.
- **State and storage:** signals for component state; the current profile comes from `ProfileService.state$` (rxjs). Anything user-scoped that lives in the browser goes through `UserStorage`. Don't add unrelated cross-service dependencies (avoid circular injection; prefer an explicit call, like `onSignOut()`).
- **Prefer a small library for hard gestures** (for example `@panzoom/panzoom`) and the Angular CDK for drag and drop, over hand-rolled code.

## Testing

- **Backend (pgTAP):** `supabase/tests/database/`. Run via `npx supabase db reset && npx supabase test db --local supabase/tests/database`. Run after any migration, RLS policy, or trigger change.
- **E2E (Playwright):** `e2e/`, config at `playwright.config.ts`. Covers invite/auth flows and the status-driven shell — landing-page invite gating, the sign-in bottom sheet, auth-guard redirects, and which screen each profile status shows (fixtures in `e2e/support/admin.ts` create users/profiles via the service role). Run via `npx playwright test` from the repo root — needs `supabase start` running (Playwright starts `ng serve` itself if it isn't already running). Run the relevant spec(s) after changes under `web/src/app/core/auth/`, `web/src/app/features/landing/`, or `web/src/app/features/auth-callback/`, `web/src/app/features/shell/`; run the full suite (`npx playwright test`) for anything broader or route/guard-related.
- **Checks (format, lint, types, build):** `npm run check` from the repo root runs Prettier `--check`, `ng lint` (angular-eslint), a type-check of `e2e/`, and a production `ng build` — it needs no Docker and is quick. Run it (or at least `npm run format:check` / `npm run lint`) after changes under `web/` or `e2e/`; fix formatting with `npm run format`.
- CI (`.github/workflows/ci.yml`) runs two parallel jobs on every push to `main` and every PR, always in full regardless of what changed locally: `check` (the checks above) and `e2e` (`supabase db lint`, pgTAP, Playwright).

- **Photos e2e** (`e2e/photos.spec.ts`) covers crop, upload, persistence, failure and retry, and mouse and emulated-touch reordering. Real-device touch isn't covered. When adding tests that interact with a bottom sheet, wait for its animation to settle before dragging. The `expect` timeout is 15 s because the first visit to a lazy chunk compiles on the cold dev server.
- Run pgTAP and `npx supabase db lint --local --schema public --fail-on error` after schema changes. Don't call `require_auth_uid()` inside a `where` clause (lint complains); assign it to a variable first.

Known Angular/Material gotchas hit while building this (worth knowing before repeating them):
- Field initializers that reference an injected dependency must use `inject()`, not constructor-parameter properties — constructor param properties are assigned *after* field initializers run, so `readonly form = this.fb.group(...)` with `constructor(private fb: FormBuilder)` throws "used before initialization."
- Don't set a `mat-stepper`'s initial step via `@ViewChild` + imperative `selectedIndex =` after render — `CdkStepper`'s own content-init logic runs after that and silently overwrites it. Bind `[selectedIndex]` from the template instead, computed before the stepper exists.
- supabase-js can deadlock if you call it synchronously from inside an auth state change callback. `AuthService.userId$` uses `observeOn(asyncScheduler)` for this reason; keep that if you touch it.
- `@panzoom/panzoom` applies its start position asynchronously, so pass `startX`/`startY` as options instead of calling `pan()` right after creating it. It also sets `overflow: hidden` on the parent unless you pass `overflow: 'visible'`.
- Drawing images from the storage server onto a canvas taints it in the e2e browser. Fetch the blob and use `createImageBitmap` instead.
- On an auth callback page, prefer a hard redirect (`window.location.href`) over `router.navigateByUrl` once a session is detected — Supabase-js strips the token from the URL via a same-document navigation that races with and can cancel an in-flight Angular Router navigation.
