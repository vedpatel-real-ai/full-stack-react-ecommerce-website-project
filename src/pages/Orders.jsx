import React, { useState } from "react";
import { quote } from "../pricing.js";
import * as db from "@store";
import {
  Feedback,
  Lines,
  Pager,
  Result,
  go,
  money,
  useAction,
  useData,
} from "../ui.jsx";
export function Cart({ version, refresh, checkout }) {
  const state = useData(
    () => Promise.all([db.basket(), db.pricePolicy()]),
    [version],
  );
  const action = useAction(refresh);
  const [method, set] = useState("online"),
    [address, setAddress] = useState("");
  return (
    <>
      <h1>{checkout ? "Review checkout" : "Your basket"}</h1>
      <Result state={state}>
        {([lines, terms]) => (
          <>
            {lines.length ? (
              <>
                <Lines lines={lines} />
                {!checkout &&
                  lines.map((l) => (
                    <div className="row" key={l.sku}>
                      <small>{l.variant}</small>
                      <button
                        disabled={action.busy}
                        aria-label={"Remove one " + l.sku}
                        onClick={() => action.run(() => db.change(l.sku, -1))}
                      >
                        −
                      </button>
                      <button
                        disabled={action.busy || l.qty === 20}
                        aria-label={"Add one " + l.sku}
                        onClick={() => action.run(() => db.change(l.sku, 1))}
                      >
                        +
                      </button>
                    </div>
                  ))}
                <p className="price">
                  Total {money(quote(lines, terms).total)}
                </p>
              </>
            ) : (
              <p>
                Your basket is empty.{" "}
                <a href="/products">Browse the collection</a>
              </p>
            )}
            {checkout && (lines.length > 0 || db.pendingAttempt()) ? (
              <div className="panel">
                <h2>
                  {db.demo
                    ? "Demo payment — no money charged"
                    : "Merchant sandbox"}
                </h2>
                <p>
                  {db.demo
                    ? "Delivery uses a fictional studio address."
                    : "Use a synthetic address in staging."}{" "}
                  Shipping {money(terms.shipping)} · Added tax{" "}
                  {money(quote(lines, terms).tax)}.
                </p>
                {db.demo ? (
                  <label>
                    Payment scenario
                    <select
                      value={method}
                      onChange={(e) => set(e.target.value)}
                    >
                      <option value="online">Gateway simulator</option>
                      <option value="cod">Cash on delivery simulator</option>
                    </select>
                  </label>
                ) : (
                  <label>
                    Shipping address
                    <input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      maxLength="240"
                      required
                    />
                  </label>
                )}
                <button
                  className="primary"
                  disabled={
                    action.busy || (!db.demo && address.trim().length < 3)
                  }
                  onClick={() =>
                    action.run(async () =>
                      go(
                        "/orders/" +
                          (await db.place(lines, method, terms, address)),
                      ),
                    )
                  }
                >
                  {db.demo ? "Create demo order" : "Continue to sandbox"}
                </button>
              </div>
            ) : !checkout && lines.length > 0 ? (
              <a className="button primary" href="/checkout">
                Review checkout
              </a>
            ) : null}
          </>
        )}
      </Result>
      <Feedback action={action} />
    </>
  );
}
export function Orders({ version }) {
  const [page, set] = useState(0);
  const logged = db.identity() !== "visitor";
  const state = useData(
    () => (logged ? db.orders(page) : []),
    [version, page, logged],
  );
  return (
    <>
      <h1>Your orders</h1>
      {!logged ? (
        <a href="/auth">Sign in to see your orders</a>
      ) : (
        <Result state={state}>
          {(rows) => (
            <>
              {rows.length ? (
                <ul className="lines">
                  {rows.map((o) => (
                    <li key={o.id}>
                      <a href={"/orders/" + o.id}>{o.reference}</a>
                      <span>
                        {db.demo ? "Demo " : ""}
                        {o.payment} · {money(o.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No orders on this page.</p>
              )}
              <Pager page={page} set={set} count={rows.length} />
            </>
          )}
        </Result>
      )}
    </>
  );
}
export function Detail({ id, version, refresh }) {
  const state = useData(
    () =>
      db.identity() === "visitor" || !/^([0-9a-f-]{36})$/.test(id)
        ? null
        : db.order(id),
    [id, version],
  );
  const a = useAction(refresh);
  return (
    <Result state={state}>
      {(o) =>
        o ? (
          <>
            <p className="eyebrow">ORDER RECORD</p>
            <h1>Order {o.reference}</h1>
            <p className="notice">
              {db.demo ? "Demo payment — no money charged" : "Merchant sandbox"}
            </p>
            <div className="metrics">
              <div>
                Payment<strong>{o.payment}</strong>
              </div>
              <div>
                Confirmation<strong>{o.phase}</strong>
              </div>
              <div>
                Fulfilment<strong>{o.fulfilment}</strong>
              </div>
            </div>
            <Lines lines={o.lines} />
            <dl>
              <dt>Items</dt>
              <dd>{money(o.subtotal)}</dd>
              <dt>Shipping</dt>
              <dd>{money(o.shipping_fee)}</dd>
              <dt>Added tax</dt>
              <dd>{money(o.tax)}</dd>
              <dt>Total</dt>
              <dd>{money(o.amount)}</dd>
            </dl>
            <p>Deliver to {o.destination}</p>
            <button onClick={() => window.print()}>
              Print order statement
            </button>
            {db.demo && o.method === "online" && o.phase !== "resolved" && (
              <section className="panel noPrint">
                <h2>Gateway simulator</h2>
                <p>Choose an outcome to exercise this local order.</p>
                <div className="row">
                  {["captured", "declined", "cancelled", "pending"].map((s) => (
                    <button
                      disabled={a.busy}
                      key={s}
                      onClick={() =>
                        a.run(
                          () => db.simulate(id, s),
                          "Local scenario recorded.",
                        )
                      }
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </section>
            )}
            <Feedback action={a} />
            <a href="/orders">All orders</a>
          </>
        ) : (
          <>
            <h1>Order unavailable</h1>
            <a href="/orders">Your orders</a>
          </>
        )
      }
    </Result>
  );
}
