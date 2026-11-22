# Database verification

Native PostgreSQL 18.7 applies migrations 001–007 from an empty cluster with a minimal Supabase-auth fixture. Separate connections exercise row locking, transaction rollback and owner visibility. Browser flows apply the same migrations to PGlite. The fixture sets the session subject under trusted test control; it does not implement Supabase JWT validation.

| Migration           | Verified behavior                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 001_store           | Initial schema, profile provisioning, RLS, price/quantity constraints, atomic cart/order/receipt workflows, staff actions |
| 002_reconciliation  | Concurrent SKIP LOCKED claims, bounded retry budget and scheduled next check                                              |
| 003_operations      | Narrow service lookup, optimistic catalog versions and review throttling                                                  |
| 004_handoff         | Single initiation, immutable snapshots and disputed capture escalation                                                    |
| 005_price_policy    | Fee review, integer arithmetic and retained shipping/tax components                                                       |
| 006_catalog_media   | Ordered bounded slots, role checks and atomic replacement                                                                 |
| 007_refund_requests | One auditable review request; payment remains unchanged until authoritative evidence                                      |

[Entity and privilege matrix](../database-and-security.md) · [Executable native tests](../../tests/postgres.test.js). Actual hosted roles, PostgREST exposure and advisor results need disposable project verification. Catalog storage is relational; the application provisions no object bucket.
