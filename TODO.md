# TODO

- Angular karma tests
- Implement onboarding flow
  - Options selection: Allow specific order
  - eMail on registration
- Set up eMail templates (with logo and whatnot)
- Clean up CLAUDE etc. Improve infrastructure
- Add license
- Security review (repeat occasionally)
- Deploy to staging
  - Staging disclaimer
- Add Terms & Conditions and Privacy Policy

- Publish repo
- Add event log / audit log table?
- Photos bucket cleanup
- Report photos / profile

## Testing

- **Playwright e2e suite is in place**, covering invite/auth flows: landing-page invite gating, the sign-in bottom sheet, and the auth guard redirect. See `e2e/` and CLAUDE.md's Testing section for how to run it.
- **Not yet covered by e2e:** `/apply/start` (skipped deliberately — likely to be rewritten, see the "delete most of the old apply flow" note above), the full apply flow with autosave/resume (the multi-step stepper), and photo upload. Worth adding once that part of the UI stabilizes.
- Backend (schema, RLS, triggers) has pgTAP coverage in `supabase/tests/database/` — keep extending this as new tables/policies are added, it's cheap and already caught one real bug (missing `authenticated` grants) that manual testing missed.
- **No Angular unit tests exist** (zero `*.spec.ts`). Karma is configured but would fail on an empty suite and is on its way out; the Vitest-based `@angular/build:unit-test` builder is still experimental in Angular 20.3 and became stable/default in Angular 21. Revisit alongside an Angular 21 upgrade rather than building on Karma.
- **Lint skips `web/src/app/features/apply/`** (see `web/eslint.config.js`) because that flow will likely be deleted. If it ends up being kept, remove the ignore and fix what it flags.
- **Branch protection:** CI only gates anything once PRs are used. When that starts, enable branch protection on `main` with required status checks `check` and `e2e` (a GitHub repo setting, not a file).

## Product/next slice

- Browse, connections/intros, and messaging are not built. See `PRODUCT.md` for the MVP scope and `CLAUDE.md` for the messaging/RxDB plan.
