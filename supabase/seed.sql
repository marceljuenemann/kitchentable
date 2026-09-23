-- Local dev / e2e test invite codes.
-- Applied automatically after migrations on every `supabase start` (first boot) and
-- `supabase db reset` -- see [db.seed] in config.toml.
insert into public.invite_codes (code, max_uses, use_count) values
  ('E2E-FRESH', 1000, 0),      -- reusable happy-path code, owned by the e2e suite
  ('E2E-EXHAUSTED', 1, 1),     -- pre-exhausted, owned by the e2e suite
  ('TESTCODE', 1000, 0);       -- for manual poking around locally, not used by tests
