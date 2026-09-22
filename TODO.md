# TODO

- Add database documentation
- Review code under web/
- Application fields to JSON?
- Profile not updateable? Stored procedure only? Constraints on fields?
- Recreate database (single migration)
- GitHub workflow

## Testing

- **No automated frontend/e2e test suite yet.** The application flow (invite → magic link → apply stepper → submission) was verified manually with a throwaway Playwright script during development, not checked into the repo. Worth adding a real Playwright test suite once the UI stabilizes, covering at least: invite gating, the full apply flow with autosave/resume, and photo upload.
- Backend (schema, RLS, triggers) has pgTAP coverage in `supabase/tests/database/` — keep extending this as new tables/policies are added, it's cheap and already caught one real bug (missing `authenticated` grants) that manual testing missed.

## Admin review

- Application review is fully manual right now (flip `application_status` in Supabase Studio). The originally-discussed flow — email notification to the admin on submission with a tokenized one-click approve link (via Resend) — was deliberately deferred to get the applicant-facing UX right first. Build this next once the apply flow feels solid.

## Product/next slice

- Browse, connections/intros, and messaging are not built. See `PRODUCT.md` for the MVP scope and `CLAUDE.md` for the messaging/RxDB plan.
