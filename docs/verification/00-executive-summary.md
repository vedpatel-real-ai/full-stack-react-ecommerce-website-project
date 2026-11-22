# Engineering summary

The commercial master and the personal main matched the supplied baseline SHAs. Inspection identified a legacy CRA simulator in the destination, dependencies on commercial infrastructure in the reference, and historic credential exposure in both repositories. The client supplied no license file or separate republication grant. The new application uses independently authored code, stationery fixtures and artwork.

The highest-priority changes are transactional, price-checked checkout, immutable order snapshots, an event journal and isolated financial privileges. SKU editions and owner identity survive checkout and reporting. Guest cart mutations and gateway initiation are replay-safe. The public app cannot contact the merchant. A dedicated staging provider, current merchant kit, status transport and operational approval are required before external payment verification.

Seven ordered migrations run from scratch in the browser simulator and a native disposable PostgreSQL cluster. The browser suite tests real rendered customer and staff workflows. The [QA report](05-qa-results.md) and [release matrix](07-release-gates.md) distinguish implementation evidence from external verification.

## Delivery checkpoints

1. Preserve personal Git history, map both trees, establish prior test behavior and publication limits.
2. Replace legacy runtime and isolate secrets, then implement financial schema, RLS, evidence and server contracts.
3. Exercise editions, concurrent carts, statements, refund review, staff workflows and image processing.
4. Run clean-install, database, browser, artifact, accessibility and CI checks, publish a reviewable PR and merge only where checks permit.
