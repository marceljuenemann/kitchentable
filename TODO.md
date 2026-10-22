# TODO

- Reconfigure chunks (see npm run build)
- Publish repo

- Photos improvements for slow connections: upload in background, cache locally
- Add event log / audit log table?
- Photos bucket cleanup
- Report photos / profile
- Automate invite codes & checks (probably per user)
- Account deletion
- Security review (repeat occasionally)
- Automated accessibility cheks with axe

## Supabase before production

Plan: a Pro project for production, for daily backups and no pausing. Point-in-time recovery is optional.
Account and database: MFA on your Supabase account, "Enforce SSL" on the database, and a run of the dashboard's Security Advisor.
Separate production project: environment.prod.ts is empty, so this is clearly planned. Keep production secrets in their own GitHub environment with required reviewers.
Auth: captcha, production rate limits, and a production redirect-URL allowlist. A custom auth domain would let sign-in links show kitchentable.dating instead of …supabase.co, which looks less like phishing; it's a paid add-on.
Mail: DMARC is p=none with reports going to Mailtrap's staging address. Fine for now; move towards quarantine once the reports look clean. I didn't verify Mailtrap's SPF and DKIM setup.