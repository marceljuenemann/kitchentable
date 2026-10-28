# Database

Postgres via Supabase. The schema lives in `supabase/migrations/` and is covered by pgTAP tests in `supabase/tests/database/`. **Update this file with any schema change.**

Sections marked **(planned)** describe connections and messaging, which aren't built yet. Update them as they're built, and move anything that turns out differently.

## Access rules

- **Writes go through `security definer` functions** that check `auth.uid()`, so the rules and state changes live in one auditable place instead of being spread across RLS policies. Functions are added as the features that need them are built.
- **`profiles` and `analytics_events` have no client access at all:** all privileges are revoked from `anon` and `authenticated`, and RLS is on with no policies as a backstop. Reads go through functions too.
- **RLS is used where the rules are simple enough for a policy:**
  - `terms_acceptances`: users read their own rows and insert their own (see [terms_acceptances](#terms_acceptances)).
  - the `photos` storage bucket: owner-only (`<user id>/<photo id>/...`), because uploads go straight from the browser, plus read access for admins (vetting). See [photos.md](photos.md).
  - **(planned)** `connections`, `connection_secrets` and `messages`: `select` only, so RxDB can pull them (see [Messaging sync](#messaging-sync-planned)). Writes still go through functions.
- **RLS filters rows, not columns.** Anything one participant may see but the other may not (such as read state) lives in its own row, never in a column of a shared row. Column privileges (`grant select (…)`) could hide a column, but they break `select *`, which replication uses, and it isn't clear that Realtime respects them.
- **The `service_role` has full table access** (admin tooling, webhooks, e2e fixtures).

## Profile status

| Status      | Meaning                                                            | Client sees                                                                                     |
| ----------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| _(no row)_  | signed up, terms not accepted                                      | terms screen                                                                                    |
| _(no row)_  | terms accepted, onboarding not submitted                           | onboarding                                                                                      |
| `vetting`   | submitted, an admin is reviewing                                   | "being vetted" message                                                                          |
| `approved`  | admin approved, age verification pending                           | age verification                                                                                |
| `active`    | verified and live                                                  | main app                                                                                        |
| `disabled`  | hidden by the user: not in search, can't message until unhidden    | "profile hidden" screen with a way to unhide it (planned; the shell shows the main app for now) |
| `suspended` | suspended by an admin                                              | suspended message                                                                               |
| `deleted`   | deleted by the user: can no longer message; personal data scrubbed | deleted message                                                                                 |
| `admin`     | an admin account, never shown to members (see [Admins](#admins))   | main app                                                                                        |

There is no `rejected` status; a rejected applicant simply stays in `vetting`. Add one when someone actually needs rejecting.

Only onboarding submission (`submit_onboarding`) and approval (`admin_approve_application`) are implemented so far; until the other functions exist, statuses are changed by an admin in Studio. `admin` has no transitions: it is only ever set by hand.

| From                 | To          | Who                                 |
| -------------------- | ----------- | ----------------------------------- |
| _(no row)_           | `vetting`   | user (onboarding submit)            |
| `vetting`            | `approved`  | admin (`admin_approve_application`) |
| `approved`           | `active`    | age-verification webhook            |
| `active`             | `disabled`  | user                                |
| `disabled`           | `active`    | user                                |
| `active`, `disabled` | `suspended` | admin                               |
| `suspended`          | `active`    | admin                               |
| any except `deleted` | `deleted`   | user                                |

Deletion should keep the row as a tombstone (so conversations still resolve) and scrub the personal fields and photos.

Anything that depends on status (search visibility, who may message) should derive from these definitions in one place, so the rules cannot drift.

## Tables

### `profiles`

One row per user who has **completed onboarding**. Signing up creates only an `auth.users` row, so "no profile row" means the user still needs to onboard (the draft lives in the browser's localStorage until it's submitted). Rows only come from `submit_onboarding` (or by hand, for [admins](#admins)), and a trigger refuses any row for a user who hasn't accepted the terms. No client access: see [Functions](#functions).

| Column                                | Type          | Notes                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                  | `uuid`        | Primary key, = `auth.users.id`; deleted with the account.                                                                                                                                                                                                                                                                                          |
| `status`                              | enum          | See [Profile status](#profile-status).                                                                                                                                                                                                                                                                                                             |
| `vetting_answers`                     | `jsonb`       | Answers to the vetting questions, keyed by question id (one object rather than a column each, since the questions will change and are never filtered on). Also holds `invite_code` (see [Signup and invite codes](#signup-and-invite-codes)) and `onboarding_feedback`, the optional answer to "How did you find signing up?". Only admins see it. |
| `name`, `pronouns`, `bio`, `location` | `text`        | Required.                                                                                                                                                                                                                                                                                                                                          |
| `tagline`                             | `text`        | Required, but may be empty.                                                                                                                                                                                                                                                                                                                        |
| `gender`, `sexuality`                 | `text[]`      | The options picked in onboarding, in the order picked, stored as their text (`GENDER_OPTIONS`, `SEXUALITY_OPTIONS` in `onboarding-options.ts`). Can also hold the user's own descriptions, as they typed them. May be empty.                                                                                                                       |
| `looking_for`                         | `text[]`      | Ids of the standard options (`LOOKING_FOR_OPTIONS`, so labels can be reworded without a migration), or the user's own text for anything else. May be empty.                                                                                                                                                                                        |
| `birth_year`, `birth_month`           | `int`         | Optional, so the only nullable columns.                                                                                                                                                                                                                                                                                                            |
| `photos`                              | `uuid[]`      | Photo ids in display order, the first being the main photo; at most 6 (a check). The files are in the `photos` bucket: see [photos.md](photos.md).                                                                                                                                                                                                 |
| `messages_emailed_at` **(planned)**   | `timestamptz` | When the user was last emailed about new messages; null until the first email. See [Message emails](#message-emails-planned).                                                                                                                                                                                                                      |
| `created_at`, `updated_at`            | `timestamptz` | `updated_at` is set by a trigger.                                                                                                                                                                                                                                                                                                                  |

### `terms_acceptances`

Before anything else, a signed-in user accepts the Terms of Use and gives the explicit consent the Privacy Policy asks for (section 5, for special category data). Both are on one screen, as separate checkboxes, after the email address is confirmed. One row records both.

| Column        | Type          | Notes                                                                                                                                                                     |
| ------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user_id`     | `uuid`        | Defaults to `auth.uid()`, so it always comes from the server.                                                                                                             |
| `version`     | `int`         | Raised only for changes everyone needs to accept again, separately from the version printed on each document. The current one is `TERMS_VERSION` in `profile.service.ts`. |
| `accepted_at` | `timestamptz` | Defaults to `now()`.                                                                                                                                                      |

- **Primary key `(user_id, version)`,** so accepting a new version keeps the earlier record, and accepting the same version again fails as a duplicate (`23505`), which the app treats as done.
- **Client access is RLS, without functions:** `select` of the user's own rows, and `insert` of the `version` column only. There is no `update` or `delete`.
- **Kept until the account is deleted,** and deleted with it: this is the consent record the Privacy Policy describes.
- **A profile always implies accepted terms:** the `profiles_require_terms_accepted` trigger refuses any profile insert (from `submit_onboarding`, Studio or a fixture) for a user without an acceptance of any version.
- **The app checks only users without a profile** (a row with `version >= TERMS_VERSION`, after `get_my_profile` returns null), because of that trigger. Once there is a version 2, users with a profile need checking too.

### `analytics_events`

First-party product analytics: no third-party service and nothing stored in the browser for it. Events are recorded on the server against the signed-in user's session, so no cookie consent is needed. The legal basis is legitimate interests (GDPR). No client access: events are written only through `track_event`.

| Column       | Type          | Notes                                     |
| ------------ | ------------- | ----------------------------------------- |
| `id`         | `bigint`      | Identity.                                 |
| `user_id`    | `uuid`        | Deleted with the account.                 |
| `name`       | `text`        | Allowlisted in `track_event`.             |
| `props`      | `jsonb`       | Optional small facts, like a step number. |
| `created_at` | `timestamptz` | Indexed with `name`.                      |

- **Use existing data first.** Sign-ups (`auth.users.created_at`), clicked links (`email_confirmed_at`, `last_sign_in_at`) and profile statuses are already in the database. Events are only for things that leave no other trace, such as onboarding progress, because the draft stays in the browser until it is submitted.
- **Never record** other people's ids (e.g. "viewed profile X"), free text or profile content.
- **Adding an event needs a migration,** since names are allowlisted. Current events: `onboarding_step_viewed` (`{"step": n}`, sent each time a step is shown, including after a reload).
- **Retention:** the `purge-analytics-events` pg_cron job deletes events older than 3 months every night.
- **Objections** (GDPR Art. 21): there's no opt-out setting yet, so delete the user's rows by hand.
- **Reading the data:** the Studio SQL editor (service role). There are no views yet. Write them when there's an analysis to do.

### `connections` (planned)

One per pair of users who have been in touch: what they share. An intro is a `pending` connection; the intro text is its first message, in `messages` (PRODUCT.md: an intro message instead of a like). Both users can `select` it. What each user sees only for themselves (read state, declining) is in `connection_secrets`.

| Column                         | Type          | Notes                                                                                                                                       |
| ------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `initiator_id`, `recipient_id` | `uuid`        | Primary key. A unique index on `(least(…), greatest(…))` also stops the reverse pair, so there's at most one connection between two people. |
| `status`                       | enum          | `pending` (intro sent) or `accepted`. Declining isn't a status, because the initiator can read this row: see `connection_secrets`.          |
| `looking_for`                  | `text[]`      | What the initiator wants to connect on, picked from the `looking_for` values on the two profiles. Not empty.                                |
| `created_at`, `updated_at`     | `timestamptz` | `updated_at` is set by a trigger, for replication.                                                                                          |

No separate id: a connection is identified by its two users, so messages and the functions refer to the other person instead. RxDB supports composite primary keys.

### `connection_secrets` (planned)

**Only `user_id` can see their row; the other person never can.** One user's private side of a connection, or of a possible one: every pair of members is a potential connection, so a row can exist without a `connections` row (for example after dismissing someone in search). A row exists only once there's something to record: `send_intro` creates one for each side, and dismissing someone creates one if needed. Each use case has its own function (see [Functions](#functions)).

| Column                     | Type          | Notes                                                                                                                                                                        |
| -------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user_id`, `other_user_id` | `uuid`        | Primary key.                                                                                                                                                                 |
| `last_read_at`             | `timestamptz` | Read watermark for the conversation with that person. Null until the user first opens it, so a new intro is unread; the initiator's starts at the time of the intro.         |
| `dismissed_at`             | `timestamptz` | The user dismissed that person in search. It only hides them from the user's own search: they can still send an intro, which shows as usual.                                 |
| `declined_at`              | `timestamptz` | The user declined that person's intro. Kept here so the initiator isn't told: to them, a declined intro just looks unanswered. Also hides the person from the user's search. |
| `updated_at`               | `timestamptz` | Set by a trigger, for replication.                                                                                                                                           |

**Read state without read receipts:** a message is unread for its recipient if it was sent after their `last_read_at` (or they've never opened the conversation), unless they declined the intro. An intro is just the first message, so new intros are unread the same way, and the same email covers them. Opening a conversation moves the watermark: one write, however many messages there were. The sender never sees it, because it's in the reader's own row. A read flag on each message would have to be hidden from the sender by column, and the recipient would be updating rows someone else wrote.

**Mutual reveals** (an idea for later, such as both saying they're ready for a date, shown only once both have) follow the same pattern: each person's answer is a column in their own row, and the function that sets it checks the other person's row. Once both have answered, it writes the result into `connections`, where both can see it. Until then, neither can tell what the other said.

### `messages` (planned)

The sender and recipient can `select` them.

| Column                      | Type          | Notes                                                                                                                                                                                                                                   |
| --------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                        | `uuid`        | Generated by the client, so a send retried after a dropped connection hits `on conflict do nothing` instead of a duplicate.                                                                                                             |
| `sender_id`, `recipient_id` | `uuid`        | The connection is the pair. There's no foreign key to `connections` (the pair can be in either order there); `send_intro` and `send_message` check it. Indexed `(sender_id, updated_at)` and `(recipient_id, updated_at)` for the pull. |
| `content`                   | `jsonb`       | `{"type": "text", "text": "…"}` for now, so other kinds (images, reactions) can be added later. Types are allowlisted in the functions, like event names in `track_event`, and the text is length-checked.                              |
| `created_at`                | `timestamptz` | Set by the server.                                                                                                                                                                                                                      |
| `updated_at`, `deleted`     |               | For replication: `updated_at` is set by a trigger, and deletions are soft so they replicate too (with `content` cleared).                                                                                                               |

## Functions

All are `security definer` and check `auth.uid()`. Admin functions raise `insufficient_privilege` (`42501`, "Admins only.") for anyone else.

| Function                                                                                                                                                              | Who       | Does                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `get_my_profile()`                                                                                                                                                    | user      | The caller's profile without `vetting_answers`, or `null` if there is no row. Drives which screen the app shows.                                                                                                                                                    |
| `submit_onboarding(p_name, p_pronouns, p_tagline, p_bio, p_location, p_gender, p_sexuality, p_birth_year, p_birth_month, p_looking_for, p_photos, p_vetting_answers)` | user      | Creates the caller's profile in `vetting` (it needs accepted terms), adding the invite code from their sign-up metadata to the vetting answers. Raises `unique_violation` (`23505`) if they already have one.                                                       |
| `track_event(p_name, p_props)`                                                                                                                                        | user      | Records an analytics event. Rejects unknown names and `p_props` that isn't a JSON object of at most 500 characters.                                                                                                                                                 |
| `is_admin()`                                                                                                                                                          | anyone    | Whether the caller is an admin (false when signed out). Also used by the `photos_select_admin` storage policy.                                                                                                                                                      |
| `admin_list_applications()`                                                                                                                                           | admin     | The profiles in `vetting`, oldest first, as whole rows (`vetting_answers` included), so opening one needs no further request.                                                                                                                                       |
| `admin_approve_application(p_id)`                                                                                                                                     | admin     | Moves a profile from `vetting` to `approved`; raises for anything else, so an application can't be decided twice.                                                                                                                                                   |
| **(planned)** `send_intro(p_recipient_id, p_looking_for, p_message_id, p_content)`                                                                                    | user      | Creates the `pending` connection, the first message and both `connection_secrets` rows (or updates them, if one exists from a dismissal). Checks the daily intro limit (PRODUCT.md suggests 3), that both users are `active`, and that they have no connection yet. |
| **(planned)** `accept_intro(p_initiator_id)`                                                                                                                          | recipient | Sets the connection to `accepted`.                                                                                                                                                                                                                                  |
| **(planned)** `decline_intro(p_initiator_id)`                                                                                                                         | recipient | While the connection is `pending`, sets `declined_at` on the recipient's `connection_secrets` row. The connection is untouched, so the initiator isn't told.                                                                                                        |
| **(planned)** `send_message(p_id, p_recipient_id, p_content)`                                                                                                         | either    | Needs an `accepted` connection between the two, a sender who is `active`, and a recipient who isn't `deleted`.                                                                                                                                                      |
| **(planned)** `mark_read(p_user_id, p_read_at)`                                                                                                                       | either    | Moves the caller's `last_read_at` forward to `p_read_at`, the time they read the conversation on their device, capped at `now()`.                                                                                                                                   |
| **(planned)** `set_dismissed(p_user_id, p_dismissed)`                                                                                                                 | user      | Dismisses someone in search, or undoes it.                                                                                                                                                                                                                          |
| **(planned)** `get_connection_profiles()`                                                                                                                             | user      | Names and photos of the people the caller has connections with.                                                                                                                                                                                                     |

The device's time in `mark_read` matters offline: with the time of the push instead, messages that arrived on the server between reading and syncing would count as read without the user having seen them.

## Messaging sync (planned)

The app keeps connections and messages in a local RxDB database, so it feels instant and copes with spotty connections. It has three collections mirroring the tables: `connections`, `connection_secrets` (the user's own rows) and `messages`. The UI reads only from these, so the conversation list, unread badges and search filtering work offline.

- **Pull:** RxDB reads the three tables through the REST API, under the `select` policies above, by an `(updated_at, id)` checkpoint.
- **Live updates:** a Realtime subscription only tells RxDB to pull now (`RESYNC`); the pull is the only source of data, so a missed event just means the next pull catches up.
- **Writes that work offline** go through RxDB: the local document is written first, and RxDB's generic replication (`replicateRxCollection`) pushes it with a custom handler per collection. A new message calls `send_message`. For `connection_secrets`, the handler looks at which column changed: `last_read_at` calls `mark_read`, `dismissed_at` calls `set_dismissed`.
- **Writes that should fail fast** (`send_intro`, `accept_intro`, `decline_intro`) are called directly, online only, so the user hears about the daily limit and the like straight away. The app then triggers a pull. `connections` is pull-only.
- **Refused pushes:** conflicts can't really happen (messages are append-only, and only the owner writes their `connection_secrets` rows), but `send_message` can refuse a message, for example if the sender was suspended in the meantime. The push handler then marks the local message as failed so the app can show it. A pull wouldn't fix it: a refused message has no row on the server.
- **Profiles stay out of RxDB** at first: they come from `get_connection_profiles()` and are cached in memory.
- **Local data is per user** and deleted on sign-out, alongside `UserStorage.onSignOut()`.
- **To check before building:** what RxDB's Supabase replication plugin expects (column names, `select *`), or whether to use the generic replication directly as planned.

## Emails

### Admin notification

When a profile row is inserted in `vetting` (that is, an application was submitted), the `notify_admin_of_application` trigger uses `pg_net` to POST to the `notify-admin` edge function. The function emails `ADMIN_EMAIL` a link to `/admin/vetting`, and nothing else: the request has no body and the email holds no personal data.

- **No email for failed submissions:** `pg_net` sends the request only after the transaction commits, so a rolled-back submission sends nothing. It retries nothing either: if sending fails, the edge function's logs show it, and the application is saved regardless.
- **Per-environment settings:** the function's URL and a shared secret are the vault secrets `notify_admin_url` and `notify_admin_secret`. If either is missing, the trigger logs a warning and skips the request. The function compares the secret against its `NOTIFY_ADMIN_SECRET`, because it runs with `verify_jwt = false`.
- **Where the settings live:** `supabase/seed.sql` and `supabase/functions/.env` locally; on staging they're set by hand, see "Staging" in README.md.
- **Locally,** the function sends to Mailpit; elsewhere, through Mailtrap's sending API.

### Message emails (planned)

A pg_cron job runs every 10 minutes and, through `pg_net`, calls a `notify-messages` edge function (set up like `notify-admin`) for each user who is due an email. The email says "You have new messages on Kitchen Table" and links to the app: no names, no message text. Intros are messages, so new intros are covered too. One email covers all conversations, which is why the state is per user (`profiles.messages_emailed_at`).

A user is due an email when:

1. they have an unread message that arrived **after their last email** (no reminders about messages we've already emailed about), and
2. that message is **at least 15 minutes old** (so people chatting in the app aren't emailed), and
3. if they haven't read anything since the last email, enough time has passed since it: at least as long as they had already been away when it was sent, and at least 1 day, at most 30 days.

"Read anything" means their latest `last_read_at` across all their `connection_secrets` rows, or when their profile was created if they've never opened a conversation. With `read` for that and `emailed` for `messages_emailed_at`, the last condition is:

```sql
read >= emailed
or now() - emailed >= least(greatest(emailed - read, interval '1 day'), interval '30 days')
```

This doubles the wait for each unanswered email without counting them: for someone who was last in the app just before the message came, emails go out after 15 minutes, then 1 day, 2, 4, 8 and 16 days, then every 30 days. Someone who had already been away for a while gets a longer wait after the first email. Reading anything resets it. An opt-out setting can come later.

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

## Admins

An admin is a separate account whose profile has status `admin`. Admins use the app like members (the shell shows them the main app; the admin tool is under `/admin`), but are never shown to members: anything member-facing only shows `active` profiles. There is no admins table and no flag elsewhere. To make an account an admin, sign in with it, accept the terms, and insert its row in Studio (the placeholders fill the `not null` columns; inserting directly skips onboarding, so no "new application" email is sent):

```sql
insert into profiles (id, status, name, pronouns, bio, location)
select id, 'admin', 'Kitchen Table', '-', '-', '-' from auth.users where email = '<address>';
```

The admin functions are listed under [Functions](#functions).

## Open questions (planned features)

- **Declined intros, later:** the sender isn't told for now, and can't send another (one connection per pair). Should a declined intro eventually be shown to the sender, expire, or be undoable by the recipient? Blocking and reporting need their own design.
- **`connections.looking_for`:** can the initiator pick only options both profiles list, or anything from their own? Custom text on either profile won't match the other's.
- **Deleted users:** their profile stays as a tombstone. Do their sent messages stay visible to the other person, or are they scrubbed?
- **Retention:** keep messages until either participant deletes their account, or for a fixed time?
- **Back-off ceiling:** once the wait reaches 30 days, keep sending monthly, or stop until the user comes back?
