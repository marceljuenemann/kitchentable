# Database

Postgres via Supabase. The whole schema lives in `supabase/migrations/`, and is covered by pgTAP tests in `supabase/tests/database/`. **Update this file with any schema change.**## Access rules

- **Clients never touch the `profiles` table directly.** All privileges are revoked from `anon` and `authenticated`, RLS is on with no policies (a backstop), and every read/write goes through a `security definer` function that checks `auth.uid()`. This keeps the flows and state changes in one auditable place instead of spread across RLS policies. Functions are added as the features that need them are built.
- `invite_codes` is likewise inaccessible to clients; only the signup trigger touches it.
- The one RLS exception is the `photos` storage bucket: owner-only (`<user id>/<photo id>/...`), because uploads go straight from the browser. Sizes, limits and privacy rules are in [photos.md](photos.md).
- The `service_role` has full table access (admin tooling, webhooks, e2e fixtures).

## Tables

- `invite_codes` — `code`, `max_uses`, `use_count`. Consumed at signup.
- `profiles` — one row per user who has **completed onboarding**; `id` = `auth.users.id`. Signing up creates only an `auth.users` row, so "no profile row" means the user still needs to onboard (draft answers live in the browser's localStorage until submitted).
  `name`, `pronouns`, `bio` and `location` are `not null` (they are required, and rows only come from `submit_onboarding`); `tagline` is `not null` too but may be an empty string. Birth month and year are the only nullable columns, since they are optional.
  Answers to the vetting questions are stored in the `vetting_answers` jsonb column (keyed by question id) rather than one column per question, since the questions will change and are never filtered on.
  Photos are the ordered `photos uuid[]` column (first = main photo, at most 6, enforced by a check), not a separate table; the files themselves live in the `photos` storage bucket. See [photos.md](photos.md).

## Signup

`handle_new_user()` (trigger on `auth.users`) validates and consumes the invite code from the signup metadata (`invite_code`). It creates nothing else. Existing users signing in again do not re-run it.

## Profile status

| Status      | Meaning                                                            | Client sees            |
| ----------- | ------------------------------------------------------------------ | ---------------------- |
| _(no row)_  | signed up, onboarding not submitted                                | onboarding             |
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

- `get_my_profile()` → the caller's profile (including the `photos` id array), or `null` if there is no row. Drives which screen the app shows.
- `submit_onboarding(p_name, p_pronouns, p_tagline, p_bio, p_location, p_gender, p_sexuality, p_birth_year, p_birth_month, p_looking_for, p_photos, p_vetting_answers)` → creates the caller's profile in status `vetting` (the only way a row gets created), or raises `unique_violation` (`23505`) if they already have one.
