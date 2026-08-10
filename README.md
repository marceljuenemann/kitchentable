# Kitchentable

An open-source, non-profit dating app, starting with a focus on the ENM (ethically non-monogamous) community in London.

See [PRODUCT.md](PRODUCT.md) for the full mission, principles, business model, and MVP plan.

Status: early-stage. The invite-gated application flow (magic-link sign-in, London check, profile, photos, consent/ENM questions, submission) is built; browse, connections, and messaging are not yet.

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

The app is invite-only, so you'll need at least one invite code before you can apply. Seed one directly against the local DB:

```bash
docker exec -i supabase_db_kitchentable psql -U postgres -d postgres \
  -c "insert into public.invite_codes (code, max_uses) values ('DEMO-CODE', 5);"
```

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

See [TODO.md](TODO.md) for known gaps, including the lack of an automated frontend/e2e test suite.
