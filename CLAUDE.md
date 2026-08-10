# Kitchentable

Open-source, non-profit dating app for London's ENM (ethically non-monogamous) community. Self-funded, run via the founder's Ltd for now, with a possible future CIC if it expands beyond London ENM.

Full product context — mission, principles, business model, MVP scope — lives in [PRODUCT.md](PRODUCT.md). Read it before making product decisions.

## Tech stack

- **Backend:** Supabase (Postgres, Auth via magic link, Storage, RLS). Schema/migrations in `supabase/migrations/`, pgTAP tests in `supabase/tests/database/`.
- **Frontend:** Angular (standalone components + signals, no NgModules) + Angular Material, in `web/`. No custom branding/theme yet — stock Material.
- **Local dev:** see [README.md](README.md) for setup. `supabase start` for the backend, `ng serve` for the frontend, Mailpit for magic-link emails.

## Status

The invite-gated application flow is built: invite code + magic-link sign-in → multi-step form (London check, profile, bio, photos, consent/ENM questions) with autosave and resume → submission, gated server-side so an incomplete application cannot reach `pending` (see `enforce_application_submission()` in the init migration). Admin review is manual for now (flip `application_status` in Supabase Studio) — no email notification/review UI yet.

Not built yet: browse, connections/intros, messaging (planned to use RxDB for offline-tolerant messaging specifically — see conversation history / PRODUCT.md for why). See [TODO.md](TODO.md) for known gaps.

Known Angular/Material gotchas hit while building this (worth knowing before repeating them):
- Field initializers that reference an injected dependency must use `inject()`, not constructor-parameter properties — constructor param properties are assigned *after* field initializers run, so `readonly form = this.fb.group(...)` with `constructor(private fb: FormBuilder)` throws "used before initialization."
- Don't set a `mat-stepper`'s initial step via `@ViewChild` + imperative `selectedIndex =` after render — `CdkStepper`'s own content-init logic runs after that and silently overwrites it. Bind `[selectedIndex]` from the template instead, computed before the stepper exists.
- On an auth callback page, prefer a hard redirect (`window.location.href`) over `router.navigateByUrl` once a session is detected — Supabase-js strips the token from the URL via a same-document navigation that races with and can cancel an in-flight Angular Router navigation.
