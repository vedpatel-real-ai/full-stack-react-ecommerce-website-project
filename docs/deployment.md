# Deployment and recovery

The default build requires no configuration. Publish dist only to a verified independent host, preserve the supplied security headers and support SPA navigation outside /api and asset paths. The public API responds with 503. Source configuration disables automatic Vercel Git deployments. No domain, merchant or deployment setting in the commercial project is part of this release.

## Independent staging

1. Obtain permission for a distinct sacrificial Supabase project and a specific HTTPS staging origin. Verify ownership, project identity, approved callback URLs, backups and absence of commercial customer data. Confirm a current CCAvenue merchant kit and approved sandbox credentials independently.
2. Inspect schema names, roles and existing grants. Take a schema and data backup into owner-controlled private storage and rehearse restoration. On a fresh instance apply only the numbered SQL files in order. Never apply the demo auth bootstrap or synthetic staff simulation to a hosted project. Expose only the folio schema as required in PostgREST and retain migration-defined grants. Recheck RLS and security advisors.
3. Configure sign-in, confirmation, recovery, redirect allowlist and optional anonymous accounts. Verify conversion keeps the user's UUID. Provision staff only through a reviewed database operation. Confirm separate merchant credentials, fee rules, invoices, retention and delivery policies.
4. Add only an approved isolated binding in config/staging.js through separate review. It constrains project reference, publishable key, project URL and origin. A staging build uses Vite's staging mode. The allowed-bindings list shipped here is empty. Bind the Fetch-compatible sandboxRouter on the separate server using the env names in .env.example. Supply the hosting provider's trusted client-address API for throttling. Never trust a client-supplied forwarding header. Configure the independent sandbox host's CSP for its reviewed Supabase connection and sandbox-only form action. Keep the public demo policy unchanged.
5. Supply the merchant-approved status inquiry implementation. Exercise authorized sandbox cases, delivery retries, chargeback handling, alerts and restoration; record redacted reference evidence. An operator must independently approve each external release. Production transport and live credentials are outside this release.

## Existing records and rollback

Legacy tables and payment identifiers are not migration input. Use a disposable restored copy for mapping product IDs to edition SKUs, price/quantity precision, ownership, previous references and paid snapshots. Preserve original references as historical identifiers. Quarantine ambiguous legacy rows and obtain owner reconciliation before any import. This repository ships no automatic import of commercial rows.

If a migration fails, stop, retain its error category, inspect the transaction and restore the disposable instance or roll forward with a new numbered migration. For deployed software, disable checkout and revert the application build while retaining financial rows. Never rewind a live payment ledger from a stale backup without reconciling subsequent provider events.

[Supabase custom schema configuration](https://supabase.com/docs/guides/api/using-custom-schemas) · [Anonymous identity conversion](https://supabase.com/docs/guides/auth/auth-anonymous)
