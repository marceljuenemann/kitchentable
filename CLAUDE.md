# Kitchentable

Open-source, non-profit dating app for London's ENM (ethically non-monogamous) community. Self-funded, run via the founder's Ltd for now, with a possible future CIC if it expands beyond London ENM.

Full product context — mission, principles, business model, MVP scope — lives in [PRODUCT.md](PRODUCT.md). Read it before making product decisions.

## Tech stack

- **Backend:** Supabase (Postgres, Auth via magic link, Storage, RLS). Schema/migrations in `supabase/migrations/`, pgTAP tests in `supabase/tests/database/`.
- **Frontend:** Angular (standalone components + signals, no NgModules) + Angular Material, in `web/`. No custom branding/theme yet — stock Material. A Material 3 theme + brand palette (violet/magenta/gold/sky, "Baloo Bhaijaan 2" + "Nunito Sans") is specced but not yet implemented — see `prototype/onboarding/`.
- **Local dev:** see [README.md](README.md) for setup. `supabase start` for the backend, `ng serve` for the frontend, Mailpit for magic-link emails. Keep both `supabase start` and `ng serve` running in the background rather than starting/stopping them per task — the user keeps them running too and is happy to share the same instance to preview changes live.

## Status

The invite-gated application flow is built: invite code + magic-link sign-in → multi-step form (London check, profile, bio, photos, consent/ENM questions) with autosave and resume → submission, gated server-side so an incomplete application cannot reach `pending` (see `enforce_application_submission()` in the init migration). Admin review is manual for now (flip `application_status` in Supabase Studio) — no email notification/review UI yet.

Not built yet: browse, connections/intros, messaging (planned to use RxDB for offline-tolerant messaging specifically — see conversation history / PRODUCT.md for why). See [TODO.md](TODO.md) for known gaps.

A high-fidelity redesign of the onboarding/application flow (landing page through submission) is dropped as a design handoff at `prototype/onboarding/` — see its README for the full spec (design tokens, copy, validation rules, state model). It has not been built yet; the current app still uses stock Material. Treat the prototype only as the visual/copy/behavior spec and rebuild it against this repo's actual Angular + Angular Material structure, not by porting its inline styles.

Known Angular/Material gotchas hit while building this (worth knowing before repeating them):
- Field initializers that reference an injected dependency must use `inject()`, not constructor-parameter properties — constructor param properties are assigned *after* field initializers run, so `readonly form = this.fb.group(...)` with `constructor(private fb: FormBuilder)` throws "used before initialization."
- Don't set a `mat-stepper`'s initial step via `@ViewChild` + imperative `selectedIndex =` after render — `CdkStepper`'s own content-init logic runs after that and silently overwrites it. Bind `[selectedIndex]` from the template instead, computed before the stepper exists.
- On an auth callback page, prefer a hard redirect (`window.location.href`) over `router.navigateByUrl` once a session is detected — Supabase-js strips the token from the URL via a same-document navigation that races with and can cancel an in-flight Angular Router navigation.
