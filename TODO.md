# TODO

- Deploy to staging
  - Recreate database (single migration)
- Landing page: Redirect already logged in user
- Add Terms & Conditions and Privacy Policy
- Add database documentation
- Review code under web/ (or probably delete most of the old apply flow)
- Application fields to JSON?
- Profile not updateable? Stored procedure only? Constraints on fields?

## Testing

- **Playwright e2e suite is in place**, covering invite/auth flows: landing-page invite gating, the sign-in bottom sheet, and the auth guard redirect. See `e2e/` and CLAUDE.md's Testing section for how to run it.
- **Not yet covered by e2e:** `/apply/start` (skipped deliberately — likely to be rewritten, see the "delete most of the old apply flow" note above), the full apply flow with autosave/resume (the multi-step stepper), and photo upload. Worth adding once that part of the UI stabilizes.
- Backend (schema, RLS, triggers) has pgTAP coverage in `supabase/tests/database/` — keep extending this as new tables/policies are added, it's cheap and already caught one real bug (missing `authenticated` grants) that manual testing missed.

## Admin review

- Application review is fully manual right now (flip `application_status` in Supabase Studio). The originally-discussed flow — email notification to the admin on submission with a tokenized one-click approve link (via Resend) — was deliberately deferred to get the applicant-facing UX right first. Build this next once the apply flow feels solid.

## Product/next slice

- Browse, connections/intros, and messaging are not built. See `PRODUCT.md` for the MVP scope and `CLAUDE.md` for the messaging/RxDB plan.
