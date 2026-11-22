# Payment threat model

| Failure or misuse                                    | Control                                                                                | Evidence                                                                 |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Browser substitutes amount, owner or outcome         | Bearer identity, allowlisted body fields, current catalog and DB-only financial writes | Gateway, router and role tests                                           |
| Old checkout totals or SKU fields                    | Review terms and exact order lines under locks; reject stale input                     | Fee-change and snapshot tests                                            |
| Timeout after creation, double click or lost handoff | Owner-bound attempt replay; one atomic outbound claim; inquiry for uncertainty         | Duplicate checkout and handoff races                                     |
| Duplicate/late callback, decline then capture        | Validate return and require independent status; append events while preserving capture | Gateway and PostgreSQL tests                                             |
| One tracking ID for two orders                       | Unique tracking ownership and transaction rollback                                     | Two concurrent payable claims                                            |
| Two capture references for one order                 | Retain both events and freeze exception status for operator review                     | Multiple-capture test                                                    |
| Unauthorized staff action or financial record loss   | Role-specific routines, immutable snapshot and event triggers                          | COD, archive, refund and privilege tests                                 |
| Missing final confirmation                           | Bounded retry claims with backoff; no state change on unconfigured status              | Worker contract and real DB claims                                       |
| Redirect claims a paid order                         | Owner fetch and displayed DB state; no GET settlement                                  | Browser refresh and guessed-order checks                                 |
| Public deployment reaches real merchant              | No hosted bundle, account binding or active API transport                              | Negative configuration, built-artifact scan, browser request observation |

The current merchant kit, actual field optionality, appropriate handling of provider-specific additional statuses, status notification delivery and operational dispute evidence remain release gates.
