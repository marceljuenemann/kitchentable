# Kitchen Table

An open-source, non-profit dating app, starting with a focus on the ENM (ethically non-monogamous) community in London.

See [PRODUCT.md](PRODUCT.md) for the full mission, principles, business model, and MVP plan.

Status: early-stage. Invite-gated sign-up, magic-link sign-in, onboarding, vetting and age verification are built, and signed-in users see a screen based on their profile status; browse, connections, and messaging are not yet.

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

### Age verification locally

Approved applicants verify their age with Didit (see "Age verification" in [docs/database.md](docs/database.md)). Locally there's no Didit API key, so "Verify my age" fails. To get past the screen, run this in Studio's SQL editor:

```sql
select complete_age_verification(id) from auth.users where email = '<address>';
```

To try the real flow against Didit's sandbox:

1. In the Didit console, create a sandbox application with the age verification workflow. Didit doesn't send webhooks to localhost, so start a tunnel (`cloudflared tunnel --url http://127.0.0.1:54321`) and add `<tunnel URL>/functions/v1/didit-webhook` as the application's webhook destination.
2. Copy `supabase/functions/.env` to `supabase/functions/.env.local` (gitignored) and set `DIDIT_API_KEY`, `DIDIT_WORKFLOW_ID` and `DIDIT_WEBHOOK_SECRET` to the application's values there.
3. Run `npx supabase functions serve --env-file supabase/functions/.env.local` while you test. It serves the functions with that file instead of `.env`. Stop it afterwards, then run `npx supabase stop && npx supabase start` to go back to the default settings, which the e2e tests need.

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

### Deploys

Every push to `main` deploys automatically once `check` and `e2e` pass (the `deploy-staging` job in `.github/workflows/ci.yml`, which runs `.github/workflows/deploy.yml`):

1. `supabase db push` — applies new migrations.
2. `supabase config push` — auth settings and email templates from `supabase/config.toml`, with the `[remotes.staging]` block overriding the local-only values (URLs, rate limits, Mailtrap SMTP instead of Mailpit). Auth settings changed in the dashboard get overwritten here, so change them in `config.toml` instead.
3. `supabase functions deploy` — the edge functions in `supabase/functions/` (settings below).
4. `ng build --configuration staging` (`environment.staging.ts`), deployed with `wrangler pages deploy`.

### GitHub secrets

The deploy's secrets live in the `staging` GitHub environment: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_AUTH_SMTP_PASS` (Mailtrap API token), `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

### Edge function settings

The edge functions' settings aren't in GitHub: they're set once by hand in the Supabase project and kept across deploys.

#### Emails

For `send-email` (see "Emails" in [docs/database.md](docs/database.md)), pick a random shared secret (`openssl rand -hex 32`) and:

```bash
npx supabase secrets set --project-ref ceqkaciklgqzfwycrrfx \
  SEND_EMAIL_SECRET=<secret> \
  ADMIN_EMAIL=admin@kitchentable.dating \
  SITE_URL=https://staging.kitchentable.dating \
  MAILTRAP_TOKEN=<mailtrap token>
```

Then in the Studio SQL editor:

```sql
select vault.create_secret('https://ceqkaciklgqzfwycrrfx.supabase.co/functions/v1/send-email', 'send_email_url');
select vault.create_secret('<secret>', 'send_email_secret');
```

#### Age verification

Staging uses a Didit sandbox application: free, with mocked checks. Set it up in the Didit console as described in "Age verification" in [docs/database.md](docs/database.md), with `https://ceqkaciklgqzfwycrrfx.supabase.co/functions/v1/didit-webhook` as its webhook destination (event `status.updated`), then:

```bash
npx supabase secrets set --project-ref ceqkaciklgqzfwycrrfx \
  DIDIT_API_KEY=<the application's API key> \
  DIDIT_WORKFLOW_ID=<the workflow's id> \
  DIDIT_WEBHOOK_SECRET=<the webhook destination's secret>
```

The console's "Try Webhook" sends a signed test event with sample data. Any answer but a 401 means the function accepts Didit's signature and timestamp.

### Pushing by hand

To push by hand instead of through CI (e.g. the first time), from the repo root:

```bash
npx supabase link --project-ref ceqkaciklgqzfwycrrfx
npx supabase db push
SUPABASE_AUTH_SMTP_PASS=<mailtrap token> npx supabase config push
```

Note `config push` applies without waiting for confirmation when stdin isn't a terminal, so don't pipe into it expecting a dry run.

## Production

https://kitchentable.dating — Supabase project "Kitchen Table" (`fdojaontbugknmrjjxjo`, London), frontend on Cloudflare Pages (`kitchentable-production`), auth emails via Mailtrap.

### Deploys

`main` is always meant to be releasable: work that isn't ready stays on a PR branch (CI runs on PRs too) or behind a flag. After each staging deploy, the `deploy-production` job in `.github/workflows/ci.yml` waits for approval ("Review deployments" on the workflow run) and then runs the same steps as staging, with `[remotes.production]` from `supabase/config.toml` and `ng build --configuration production` (`environment.prod.ts`), and without the noindex header.

It only deploys the latest commit on `main`: approving an older run that's still waiting fails rather than rolling production back, so reject those. To undo a change, revert it on `main` and deploy again; a migration that has reached staging can't be reverted, only followed by a new one.

### Secrets and settings

- **GitHub:** the `production` environment has the same secrets as `staging` (with the production database password and its own Mailtrap token) and requires a reviewer.
- **Edge functions and Vault:** set by hand as for staging, with the production project ref and `SITE_URL=https://kitchentable.dating`.
- **Age verification:** a live Didit application instead of a sandbox one, with its own API key, workflow and webhook secret.

## License

Copyright (C) 2026 HTTP 403 Limited

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, version 3.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the [GNU Affero General Public License](LICENSE) for more details.

Bundled third-party code and fonts keep their own licenses (see each package under `node_modules`); the fonts are under the SIL Open Font License and Apache License 2.0.
