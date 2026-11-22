# Architecture

The former destination rendered React pages against an in-browser Supabase imitation. The commercial reference used separate Vercel handlers, a hosted database and a browser return endpoint.

```mermaid
flowchart LR
  Legacy[Destination CRA] --> Fake[Simulated client and checkout]
  Reference[Reference storefront] --> Auth[Hosted Auth and RLS]
  Reference --> Handler[Server checkout]
  Handler --> Pending[Order]
  Handler --> Gateway[Merchant gateway]
  Gateway --> Callback[Return handler]
  Callback --> Receipt[Receipt RPC]
```

The destination now has one Vite application. Its build-time provider alias resolves to either the browser database or an explicitly reviewed staging binding. The default artifact excludes the hosted provider and all merchant code. The role simulation is intentionally observable in the browser. A staff selection in the demo grants no hosted privilege.

```mermaid
flowchart TD
  Pages[Catalog, basket, account, orders] --> Provider[Provider selected at build]
  Admin[Staff UI] --> Provider
  Provider --> Local[PGlite worker or independent hosted PostgreSQL]
  Local --> Policies[Owner policies and private staff membership]
  Cart[Tokenized cart delta] --> Lock[Profile row lock]
  Lock --> Quote[Current lines and approved terms]
  Quote --> Order[Immutable snapshot]
  Order --> Evidence[Validated events and operational history]
  Policies --> Own[Customer's own statements]
  Policies --> Staff[Scoped staff mutations and paged views]
```

Public art is authored in CSS. Uploaded media is decoded and normalized. A maximum of four ordered images per edition are stored as bounded WebP bytes in PostgreSQL. This design avoids a second write to an object bucket and abandoned objects after failed catalog edits. Large external media libraries need a separately reviewed storage design.
