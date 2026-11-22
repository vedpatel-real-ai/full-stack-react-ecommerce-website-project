# Checkout and payments

The customer reviews edition identifiers, quantity, availability, unit prices and fee policy. Money is stored in integer paise. Discounts use basis points from 0 through 9999. Prices round half up with a one-paise floor. A zero-price promotion needs a separate free-order policy. Shipping is flat and added tax applies to the merchandise subtotal, rounded once. Both default to zero in the synthetic dataset.

Checkout locks the profile and catalog rows, rechecks the expected basket and fee terms, inserts its immutable snapshot, appends an event and transfers the basket in one transaction. Availability is a yes/no sales policy. There is no counted warehouse stock or inventory reservation promise. A user's later basket changes belong to subsequent purchases.

| Identifier                 | Purpose                                                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Browser request UUID       | Reuse the same per-owner attempt on an uncertain create response. A successful replay returns the existing order.                  |
| Internal order UUID        | Owner-scoped lookup for order detail and statement.                                                                                |
| Merchant reference         | Uppercase F plus a database sequence value. The unique reference uses at most 20 characters and maps to one order. Gaps are valid. |
| Gateway tracking reference | Unique across orders. Evidence deduplicates by reference and outcome within the order.                                             |

The staging adapter verifies bearer identity against Auth, makes a single atomic gateway handoff claim, and constructs an encrypted INR request. A repeated request for a previously initiated order goes to review. An uncertain handoff requires inquiry. Automatic resubmission could create a second economic charge.

The protocol fixture uses URL-encoded fields, AES-128-CBC, an MD5-derived key and the kit-style fixed IV. These details are compatibility candidates pending the merchant's own current kit. An encrypted return must match the merchant, reference, exact rupee/paisa amount, currency, tracking reference and recognized status. The return route uses a 303 to an owner-protected page. Only independent provider inquiry can supply a hosted financial write. A callback without inquiry leaves the order pending.

| State dimension | Transition and actor                                                                                                                                                                           |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Payment         | Service evidence records pending → declined/cancelled/captured. Later capture can resolve a decline. A late decline cannot undo capture. Verified refund or chargeback retains earlier events. |
| Attempt         | Awaiting → reconciling on uncertainty, resolved on authoritative settlement. Handoff time records the single outbound claim.                                                                   |
| Inventory       | Available/unavailable per edition, checked under a shared catalog lock at creation.                                                                                                            |
| Fulfilment      | Staff may pack paid or COD goods, ship packed goods, deliver shipped goods and return delivered goods. COD collection needs delivery and a note.                                               |
| Exception       | Multiple capture references for one order preserve both events and flag the order for review.                                                                                                  |
| Refund review   | A staff request writes one audit event. An external financial event requires separate confirmation.                                                                                            |

The public merchant guide directs merchants to download their account's integration kit. A bound merchant kit, working inquiry contract and sandbox evidence are outstanding. [Merchant guide](https://www.ccavenue.com/downloads/CCAVenueIndiaUserGuide.pdf)
