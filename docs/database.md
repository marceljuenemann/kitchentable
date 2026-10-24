# Database

Postgres via Supabase. The whole schema lives in `supabase/migrations/`, and is covered by pgTAP tests in `supabase/tests/database/`. **Update this file with any schema change.**## Access rules

- **Clients never touch the `profiles` table directly.** All privileges are revoked from `anon` and `authenticated`, RLS is on with no policies (a backstop), and every read/write goes through a `security definer` function that checks `auth.uid()`. This keeps the flows and state changes in one auditable place instead of spread across RLS policies. Functions are added as the features that need them are built.
- RLS exceptions, where the rules are simple enough for policies:
  - the `photos` storage bucket: owner-only (`<user id>/<photo id>/...`), because uploads go straight from the browser. Sizes, limits and privacy rules are in [photos.md](photos.md).
  - `terms_acceptances`: users read their own rows and insert their own, through the REST API (see [Terms acceptance](#terms-acceptance)).
- The `service_role` has full table access (admin tooling, webhooks, e2e fixtures).

## Tables

- `profiles` — one row per user who has **completed onboarding**; `id` = `auth.users.id`. Signing up creates only an `auth.users` row, so "no profile row" means the user still needs to onboard (draft answers live in the browser's localStorage until submitted).
  `name`, `pronouns`, `bio` and `location` are `not null` (they are required, and rows only come from `submit_onboarding`); `tagline` is `not null` too but may be an empty string. Birth month and year are the only nullable columns, since they are optional.
  Answers to the vetting questions are stored in the `vetting_answers` jsonb column (keyed by question id) rather than one column per question, since the questions will change and are never filtered on. The same object holds `invite_code`, the code the user signed up with, if there was one (see below), and `onboarding_feedback`, the optional answer to "How did you find signing up?", if they gave one.
  Photos are the ordered `photos uuid[]` column (first = main photo, at most 6, enforced by a check), not a separate table; the files themselves live in the `photos` storage bucket. See [photos.md](photos.md).
- `analytics_events`: first-party product analytics (see below). No client access, the same as `profiles`.
- `terms_acceptances`: who accepted which version of the terms, and when (see below). Clients use it directly, under RLS.

## Terms acceptance

Before anything else, a signed-in user accepts the Terms of Use and gives the explicit consent the Privacy Policy asks for (section 5, for special category data). Both are on one screen, as separate checkboxes, after the email address is confirmed. One row in `terms_acceptances` records both.

- **Versions** are integers, raised only for changes everyone needs to accept again, separately from the version printed on each document. The current one is `TERMS_VERSION` in `profile.service.ts`. Rows are keyed by `(user_id, version)`, so accepting a new version keeps the earlier record.
- **Client access** is RLS on the table, without procedures: `select` of the user's own rows, and `insert` of the `version` column only. `user_id` defaults to `auth.uid()` and `accepted_at` to `now()`, so the user and the time always come from the server. There is no `update` or `delete`. Accepting the same version again fails as a duplicate (`23505`), which the app treats as done, keeping the first time.
- **Kept until the account is deleted,** and deleted with it: this is the consent record the Privacy Policy describes.
- **Enforced in the database:** the `profiles_require_terms_accepted` trigger refuses any profile insert (from `submit_onboarding`, Studio or a fixture) for a user without an acceptance of any version, so a profile always implies accepted terms.
- **The app checks only users without a profile** (a row with `version >= TERMS_VERSION`, after `get_my_profile` returns null), because of the trigger above. Once there is a version 2, users with a profile need checking too.

## Analytics

Product analytics stay in our own database: no third-party service and nothing stored in the browser for it. Events are recorded on the server against the signed-in user's session, so no cookie consent is needed. The legal basis is legitimate interests (GDPR).

- **Use existing data first.** Sign-ups (`auth.users.created_at`), clicked links (`email_confirmed_at`, `last_sign_in_at`) and profile statuses are already in the database. Events are only for things that leave no other trace, such as onboarding progress, because the draft stays in the browser until it is submitted.
- **Never record** other people's ids (e.g. "viewed profile X"), free text or profile content. `props` is for small facts like a step number.
- **Each event name is allowlisted** in `track_event`, so adding an event needs a migration. Current events: `onboarding_step_viewed` (`{"step": n}`, sent each time a step is shown, including after a reload).
- **Retention:** the `purge-analytics-events` pg_cron job deletes events older than 3 months every night, and deleting an account deletes its events.
- **Objections** (GDPR Art. 21): there's no opt-out setting yet, so delete the user's rows by hand.
- **Reading the data:** the Studio SQL editor (service role). There are no views yet. Write them when there's an analysis to do.

## Admin notification

When a profile row is inserted in `vetting` (that is, an application was submitted), the `notify_admin_of_application` trigger uses `pg_net` to POST to the `notify-admin` edge function. The function emails `ADMIN_EMAIL` a link to `/admin/vetting`, and nothing else: the request has no body and the email holds no personal data.

- **No email for failed submissions:** `pg_net` sends the request only after the transaction commits, so a rolled-back submission sends nothing. It retries nothing either: if sending fails, the edge function's logs show it, and the application is saved regardless.
- **Per-environment settings:** the function's URL and a shared secret are the vault secrets `notify_admin_url` and `notify_admin_secret`. If either is missing, the trigger logs a warning and skips the request. The function compares the secret against its `NOTIFY_ADMIN_SECRET`, because it runs with `verify_jwt = false`.
- **Where the settings live:** `supabase/seed.sql` and `supabase/functions/.env` locally; on staging they're set by hand, see "Staging" in README.md.
- **Locally,** the function sends to Mailpit; elsewhere, through Mailtrap's sending API.

## Signup and invite codes

Signing up is open: requesting a sign-in link for an address without an account creates one, and nothing in the database validates invite codes. This is deliberate. Sign-up and sign-in must answer the same for every email address, otherwise the forms reveal who is a member.

The landing page sends the invite code from the `?invite=` link as sign-up metadata (`invite_code` in `auth.users.raw_user_meta_data`), and `submit_onboarding` copies it into `profiles.vetting_answers` as `invite_code`. It is checked by hand during vetting. Treat it as a hint only: users can edit their own metadata before submitting, and someone who first signs in without an invite link has no code at all. There is no table of valid codes yet.

Applicants can invite friends from the "Thanks for applying" screen. Their personal code is the first 8 hex digits of the SHA-256 of their user id, worked out in the browser (`core/invite-code.ts`), so nothing is stored for it. To see who invited an applicant:

```sql
select id, name from profiles
where left(encode(sha256(id::text::bytea), 'hex'), 8) = '<invite_code>';
```

Codes handed out by hand (like the ones in the first invite links) don't match anyone.

## No passwords

Sign-in is by emailed link only, but Supabase Auth cannot switch passwords off, and its password sign-up endpoint is callable by anyone. Two things keep that harmless:

- `enable_confirmations = true` in `config.toml`: a password sign-up returns no session until the address is confirmed by its owner.
- The `discard_password` trigger on `auth.users` sets `encrypted_password` to null on every insert and password update, so no password is ever stored and every password sign-in fails. Without it, someone could sign up another person's address with a password, wait for them to join (which confirms the account), and then sign in to it.

## Profile status

| Status      | Meaning                                                            | Client sees            |
| ----------- | ------------------------------------------------------------------ | ---------------------- |
| _(no row)_  | signed up, terms not accepted                                      | terms screen           |
| _(no row)_  | terms accepted, onboarding not submitted                           | onboarding             |
| `vetting`   | submitted, an admin is reviewing                                   | "being vetted" message |
| `approved`  | admin approved, age verification pending                           | age verification       |
| `active`    | verified and live                                                  | main app               |
| `disabled`  | hidden by the user: not in search, can still message               | main app               |
| `suspended` | suspended by an admin                                              | suspended message      |
| `deleted`   | deleted by the user: can no longer message; personal data scrubbed | deleted message        |

There is no `rejected` status yet; a rejected applicant simply stays in `vetting`. Add it together with the admin tool.

### Intended transitions

Only reading (`get_my_profile`) and onboarding submission (`submit_onboarding`) are implemented so far; until the other procedures exist, statuses are changed by an admin via Studio / the service role.

| From                 | To          | Who                      |
| -------------------- | ----------- | ------------------------ |
| _(no row)_           | `vetting`   | user (onboarding submit) |
| `vetting`            | `approved`  | admin                    |
| `approved`           | `active`    | age-verification webhook |
| `active`             | `disabled`  | user                     |
| `disabled`           | `active`    | user                     |
| `active`, `disabled` | `suspended` | admin                    |
| `suspended`          | `active`    | admin                    |
| any except `deleted` | `deleted`   | user                     |

Deletion should keep the row as a tombstone (so conversations still resolve) and scrub the personal fields and photos.

Anything that depends on status (search visibility, who may message) should derive from these definitions in one place, so the rules cannot drift.

## Functions callable by signed-in users

- `get_my_profile()` → the caller's profile (including the `photos` id array, but without `vetting_answers`, which only the person vetting needs), or `null` if there is no row. Drives which screen the app shows.
- `track_event(p_name, p_props)` → records an analytics event for the caller. Rejects unknown names and `p_props` that isn't a JSON object of at most 500 characters. See [Analytics](#analytics).
- `submit_onboarding(p_name, p_pronouns, p_tagline, p_bio, p_location, p_gender, p_sexuality, p_birth_year, p_birth_month, p_looking_for, p_photos, p_vetting_answers)` → creates the caller's profile in status `vetting` (the only way a row gets created; it needs accepted terms), with the invite code from their sign-up metadata added to the vetting answers, or raises `unique_violation` (`23505`) if they already have one.
