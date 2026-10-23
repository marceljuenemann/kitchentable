# Kitchen Table

An open-source, non-profit dating app, starting with a focus on the ENM (ethically non-monogamous) community in London.

See [PRODUCT.md](PRODUCT.md) for the full mission, principles, business model, and MVP plan.

Status: early-stage. Invite-gated sign-up and magic-link sign-in are built, and signed-in users see a screen based on their profile status; onboarding, age verification, browse, connections, and messaging are not yet.

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

The app is invite-only, but the sign-up form only needs _an_ invite code in the URL: codes aren't validated at sign-up, they are stored on the profile and checked by hand during vetting (see [docs/database.md](docs/database.md)). Any code works locally:

http://localhost:4200/?invite=TESTCODE

Sign-in uses passwordless magic links. Locally, Supabase routes outgoing email to **Mailpit** instead of a real inbox — after requesting a link on the landing page, open **http://127.0.0.1:54324** to find and click it.

Useful local URLs (from `supabase start` output):
- App: http://localhost:4200
- Supabase Studio (DB browser/table editor): http://127.0.0.1:54323
- Mailpit (captured emails): http://127.0.0.1:54324

### Backend tests

Schema, access rules, stored procedures and triggers (profile lifecycle, onboarding submission) are covered by pgTAP tests. See [docs/database.md](docs/database.md) for the data model:

```bash
npx supabase db reset                              # reapplies migrations from scratch
npx supabase test db --local supabase/tests/database
```

### E2E tests (Playwright)

Covers the invite/auth flows and the status-driven shell: landing-page invite gating, the sign-in bottom sheet, auth-guard redirects, and the screen shown for each profile status.

```bash
npx supabase start      # if not already running
npx playwright test     # from the repo root; starts `ng serve` for you if it's not already running
```

Playwright captures magic-link emails via Mailpit (http://127.0.0.1:54324) instead of a real inbox. `supabase/config.toml` raises the local `auth.rate_limit.email_sent` limit to 100/hour (from the Supabase CLI's default of 2) so a full run doesn't get rate-limited — this only affects the local/CI stack, never production.

### Code quality (format, lint, types, build)

```bash
npm run check          # from the repo root; no Docker needed. Runs everything below
npm run format         # fix formatting (Prettier) — `format:check` only verifies
npm run lint           # ng lint (angular-eslint)
npm run typecheck:e2e  # type-check e2e/ (Playwright transpiles TS without checking types)
```

`check` also runs a production `ng build` (strict TypeScript + templates). CI (`.github/workflows/ci.yml`) runs the same checks as one job, in parallel with the e2e/pgTAP job.

## Staging

https://staging.kitchentable.dating — Supabase project "Kitchen Table - Staging" (`ceqkaciklgqzfwycrrfx`, London), frontend on Cloudflare Pages (`kitchentable-staging`), auth emails via Mailtrap. The staging build shows a "Staging" badge and is served with `X-Robots-Tag: noindex`.

Every push to `main` deploys automatically once `check` and `e2e` pass (the `deploy-staging` job in `.github/workflows/ci.yml`):

1. `supabase db push` — applies new migrations.
2. `supabase config push` — auth settings and email templates from `supabase/config.toml`, with the `[remotes.staging]` block overriding the local-only values (URLs, rate limits, Mailtrap SMTP instead of Mailpit). Auth settings changed in the dashboard get overwritten here, so change them in `config.toml` instead.
3. `supabase functions deploy` — the edge functions in `supabase/functions/` (settings below).
4. `ng build --configuration staging` (`environment.staging.ts`), deployed with `wrangler pages deploy`.

Secrets live in the `staging` GitHub environment: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_AUTH_SMTP_PASS` (Mailtrap API token), `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

The edge functions' settings aren't in GitHub: they're set once by hand in the Supabase project and kept across deploys. For the admin notification on new applications (see "Admin notification" in [docs/database.md](docs/database.md)), pick a random shared secret (`openssl rand -hex 32`) and:

```bash
npx supabase secrets set --project-ref ceqkaciklgqzfwycrrfx \
  NOTIFY_ADMIN_SECRET=<secret> \
  ADMIN_EMAIL=admin@kitchentable.dating \
  SITE_URL=https://staging.kitchentable.dating \
  MAILTRAP_TOKEN=<mailtrap token>
```

Then in the Studio SQL editor:

```sql
select vault.create_secret('https://ceqkaciklgqzfwycrrfx.supabase.co/functions/v1/notify-admin', 'notify_admin_url');
select vault.create_secret('<secret>', 'notify_admin_secret');
```

To push by hand instead (e.g. the first time), from the repo root:

```bash
npx supabase link --project-ref ceqkaciklgqzfwycrrfx
npx supabase db push
SUPABASE_AUTH_SMTP_PASS=<mailtrap token> npx supabase config push
```

Note `config push` applies without waiting for confirmation when stdin isn't a terminal, so don't pipe into it expecting a dry run.

## License

Copyright (C) 2026 HTTP 403 Limited

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, version 3.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the [GNU Affero General Public License](LICENSE) for more details.

Bundled third-party code and fonts keep their own licenses (see each package under `node_modules`); the fonts are under the SIL Open Font License and Apache License 2.0.
