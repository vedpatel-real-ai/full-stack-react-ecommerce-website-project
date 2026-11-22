# Design decisions

| Decision                                       | Reason and consequence                                                                                                                                                            |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Replace CRA with a single Vite build           | The earlier simulator and its unknown-provenance views were unsuitable for an independent release. Maintain the destination commit ancestry.                                      |
| Use the same SQL in a worker and on PostgreSQL | Browser sessions require no credentials and can exercise persisted checkout rules. First use downloads a sizeable WASM engine. Test real concurrency on a native cluster as well. |
| Keep the UUID and gateway reference separate   | A unique sequence-backed merchant identifier fits a short alphanumeric envelope. Possession of the reference confers no order access.                                             |
| Keep an append-only event history              | A late decline cannot overwrite capture. Different capture references require investigation. Refund and fulfilment history remain separate.                                       |
| Track purchasability per edition               | The available evidence does not establish business stock counts. Sell the selected SKU only if available. Counted-stock reservation would require a different signed-off policy.  |
| Store bounded edition images transactionally   | Replacing an ordered slot and its bytes in one transaction avoids dangling uploads. Large objects and external storage policies would require a separate design.                  |
| Build the public API closed                    | Unknown merchant contracts and staging configuration cannot safely authorize a public checkout transport.                                                                         |
