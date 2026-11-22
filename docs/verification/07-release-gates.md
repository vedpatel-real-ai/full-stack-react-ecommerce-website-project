# Release gates

| Acceptance criterion                                 | Result         | Evidence or remaining gate                                                               |
| ---------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------- |
| Immutable reference reviewed                         | PASS           | Read-only mirror at ee2044d; no remote write                                             |
| One destination codebase                             | PASS           | Vite, shared pages, provider alias and shared SQL                                        |
| Personal history preserved                           | PASS           | Feature commits descend from dff08a7; inspect PR and main history for merge state        |
| Rights and provenance                                | PASS           | Independently authored new code, art and fixtures. No commercial license assumed         |
| Current tree and public bundle isolation             | PASS           | Closed API, no hosted browser fallback, artifact check                                   |
| Historical credential remediation                    | BLOCKED        | Owner rotation and usage review remain unconfirmed                                       |
| Isolated demo                                        | PASS           | Persistent local DB, conspicuous payment simulation and browser network check            |
| Local customer and staff workflows                   | PASS           | Edition selection, profile, order, review, contact, catalog and COD checks               |
| Variant and money integrity                          | PASS           | Snapshot SKU and statement, integer policy and stale-quote rejection                     |
| Financial and role authorization                     | PASS           | Native role/privilege tests, owned reads, restricted financial RPCs                      |
| Gateway reference contract                           | BLOCKED        | Short reference implemented; applicable merchant kit and real sandbox cases required     |
| Callbacks, retries and reconciliation source         | PASS           | Contract tests, independent evidence requirement, single handoff, bounded work claims    |
| Production inquiry and notifications                 | BLOCKED        | Authenticated provider status transport, notification verification and pager integration |
| Paid order retention                                 | PASS           | Archive, immutable events, refund review and delete protection                           |
| Inventory policy                                     | PASS           | Binary SKU availability checked under lock                                               |
| Counted-stock reservation                            | NOT APPLICABLE | No counted quantity is advertised                                                        |
| Local RLS and role checks                            | PASS           | Disposable real PostgreSQL, customers, public, staff and service callers                 |
| Hosted policy and identity delivery                  | BLOCKED        | Independent Supabase tenant, email confirmation/recovery and advisor evidence            |
| Hosted object bucket                                 | NOT APPLICABLE | Bounded staff image bytes are transactionally stored in PostgreSQL                       |
| Ratings, routes and fallback art                     | PASS           | Moderation, account alias, fallback art and actual 404 view                              |
| Statement and administration                         | PASS           | Snapshot totals, COD sequence, event journal, bounded staff pages                        |
| Privacy, responsiveness and automated accessibility  | PASS           | Consent, bounded input, redacted operational errors and four tested widths               |
| Local tooling and reproducible evidence              | PASS           | See QA results and repository workflow                                                   |
| Commercial invoice, retention and operational policy | BLOCKED        | Merchant/accountant sign-off and environment-specific review                             |
| Real transactions or production changes              | NOT APPLICABLE | Outside this demo release                                                                |

## External sandbox checklist

With written authorization, verify the exact order reference envelope, endpoint, key and encoding against the merchant kit. Exercise success, decline, abort, cancel, missing fields, amount/currency/merchant mismatches, duplicate/delayed/replayed return, missing return, server inquiry, partial network failure, multiple references, refund and chargeback notifications. Compare the gateway ledger to the owned order and immutable event trail. Record redacted timestamps, reference mappings and evidence of independent inquiry. Confirm role grants, region/tax policy, backup restoration, alerts and rollback before requesting any commercial release.
