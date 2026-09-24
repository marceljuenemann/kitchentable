# Kitchentable

Open-source, non-profit dating app for London's ENM (ethically non-monogamous) community. Self-funded, run via the founder's Ltd for now, with a possible future CIC if it expands beyond London ENM.

Full product context — mission, principles, business model, MVP scope — lives in [PRODUCT.md](PRODUCT.md). Read it before making product decisions.

## Tech stack

- **Backend:** Supabase (Postgres, Auth via magic link, Storage). Schema/migrations in `supabase/migrations/`, pgTAP tests in `supabase/tests/database/`. Clients access `profiles` only through stored procedures, not tables/RLS — see [docs/database.md](docs/database.md) (profile statuses, transitions, access rules); keep it updated with schema changes. Photo handling (sizes, storage layout, privacy) is in [docs/photos.md](docs/photos.md).
- **Frontend:** Angular (standalone components + signals, no NgModules) + Angular Material, in `web/`. No custom branding/theme yet — stock Material. A Material 3 theme + brand palette (violet/magenta/gold/sky, "Baloo Bhaijaan 2" + "Nunito Sans") is specced but not yet implemented — see `prototype/onboarding/`.
- **Local dev:** see [README.md](README.md) for setup. `supabase start` for the backend, `ng serve` for the frontend, Mailpit for magic-link emails. Keep both `supabase start` and `ng serve` running in the background rather than starting/stopping them per task — the user keeps them running too and is happy to share the same instance to preview changes live.

## Status

Sign-up (invite code + magic link) and sign-in are built. Signed-in users land on `/app`, a shell that shows a screen based on their profile status: no profile row → onboarding, `vetting` → "being vetted", `approved` → age verification, `active`/`disabled` → main app. Each screen includes the shared `app-header`/`app-footer` components as needed (the main app won't use the footer). Onboarding has its infrastructure (draft store, stepper) and steps 1 ("Create profile") and 2 ("About you") built; steps 3–4 are not. Age verification and the main app are placeholders. The onboarding draft lives in localStorage via `UserStorage` (`core/user-storage.ts`: keys scoped to the user id, survives session expiry, cleared only on explicit sign-out: whatever signs the user out must call `UserStorage.onSignOut()` first), and a profile row is created only on submission. Admin review is manual for now (flip `status` in Supabase Studio).

Not built yet: onboarding steps 3–4 and submission, age verification, browse, connections/intros, messaging (planned to use RxDB for offline-tolerant messaging specifically — see conversation history / PRODUCT.md for why). See [TODO.md](TODO.md) for known gaps.

A high-fidelity redesign of the onboarding/application flow (landing page through submission) is dropped as a design handoff at `prototype/onboarding/` — see its README for the full spec (design tokens, copy, validation rules, state model). Only the landing page and sign-in have been built from it so far. Treat the prototype only as the visual/copy/behavior spec and rebuild it against this repo's actual Angular + Angular Material structure, not by porting its inline styles.

## Testing

- **Backend (pgTAP):** `supabase/tests/database/`. Run via `npx supabase db reset && npx supabase test db --local supabase/tests/database`. Run after any migration, RLS policy, or trigger change.
- **E2E (Playwright):** `e2e/`, config at `playwright.config.ts`. Covers invite/auth flows and the status-driven shell — landing-page invite gating, the sign-in bottom sheet, auth-guard redirects, and which screen each profile status shows (fixtures in `e2e/support/admin.ts` create users/profiles via the service role). Run via `npx playwright test` from the repo root — needs `supabase start` running (Playwright starts `ng serve` itself if it isn't already running). Run the relevant spec(s) after changes under `web/src/app/core/auth/`, `web/src/app/features/landing/`, or `web/src/app/features/auth-callback/`, `web/src/app/features/shell/`; run the full suite (`npx playwright test`) for anything broader or route/guard-related.
- **Checks (format, lint, types, build):** `npm run check` from the repo root runs Prettier `--check`, `ng lint` (angular-eslint), a type-check of `e2e/`, and a production `ng build` — it needs no Docker and is quick. Run it (or at least `npm run format:check` / `npm run lint`) after changes under `web/` or `e2e/`; fix formatting with `npm run format`.
- CI (`.github/workflows/ci.yml`) runs two parallel jobs on every push to `main` and every PR, always in full regardless of what changed locally: `check` (the checks above) and `e2e` (`supabase db lint`, pgTAP, Playwright).

Known Angular/Material gotchas hit while building this (worth knowing before repeating them):
- Field initializers that reference an injected dependency must use `inject()`, not constructor-parameter properties — constructor param properties are assigned *after* field initializers run, so `readonly form = this.fb.group(...)` with `constructor(private fb: FormBuilder)` throws "used before initialization."
- Don't set a `mat-stepper`'s initial step via `@ViewChild` + imperative `selectedIndex =` after render — `CdkStepper`'s own content-init logic runs after that and silently overwrites it. Bind `[selectedIndex]` from the template instead, computed before the stepper exists.
- On an auth callback page, prefer a hard redirect (`window.location.href`) over `router.navigateByUrl` once a session is detected — Supabase-js strips the token from the URL via a same-document navigation that races with and can cancel an in-flight Angular Router navigation.
