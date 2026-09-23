# Kitchen Table

An open-source, non-profit dating app, starting with a focus on the ENM (ethically non-monogamous) community in London.

See [PRODUCT.md](PRODUCT.md) for the full mission, principles, business model, and MVP plan.

Status: early-stage. The invite-gated application flow (magic-link sign-in, London check, profile, photos, consent/ENM questions, submission) is built; browse, connections, and messaging are not yet.

A redesign of the onboarding/application flow is specced (not yet built) as a design handoff in [prototype/onboarding](prototype/onboarding/README.md) — open `design/Onboarding.dc.html` in a browser to click through it.

## Local development

**Prerequisites:** Node.js, Docker (for the local Supabase stack).

```bash
# from the repo root
npm install                 # installs the Supabase CLI (local devDependency)
npx supabase start          # boots local Postgres/Auth/Storage; prints an ANON_KEY etc.

cd web
npm install
npm start                   # ng serve, http://localhost:4200
```

The app is invite-only. `supabase/seed.sql` pre-seeds a reusable invite code on every `supabase start` / `supabase db reset` — no manual step needed:

http://localhost:4200/?invite=TESTCODE

Sign-in uses passwordless magic links. Locally, Supabase routes outgoing email to **Mailpit** instead of a real inbox — after requesting a link at `/apply/start`, open **http://127.0.0.1:54324** to find and click it.

Useful local URLs (from `supabase start` output):
- App: http://localhost:4200
- Supabase Studio (DB browser/table editor): http://127.0.0.1:54323
- Mailpit (captured emails): http://127.0.0.1:54324

### Backend tests

Schema, RLS policies, and triggers (invite gating, the submission-completeness gate) are covered by pgTAP tests:

```bash
npx supabase db reset                              # reapplies migrations from scratch
npx supabase test db --local supabase/tests/database
```

### E2E tests (Playwright)

Covers the invite/auth flows: landing-page invite gating, the sign-in bottom sheet, and the auth guard redirect. `/apply/start`, the apply stepper, and photo upload aren't covered yet (see TODO.md).

```bash
npx supabase start      # if not already running
npx playwright test     # from the repo root; starts `ng serve` for you if it's not already running
```

Playwright captures magic-link emails via Mailpit (http://127.0.0.1:54324) instead of a real inbox. `supabase/config.toml` raises the local `auth.rate_limit.email_sent` limit to 100/hour (from the Supabase CLI's default of 2) so a full run doesn't get rate-limited — this only affects the local/CI stack, never production.

See [TODO.md](TODO.md) for remaining gaps, including e2e coverage for `/apply/start`, the apply stepper, and photo upload.
