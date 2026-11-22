import React, { useState } from "react";
import * as db from "@store";
import { Art, Feedback, Result, money, useAction, useData } from "../ui.jsx";
export function Shop({ home = false, version }) {
  const [search, setSearch] = useState("");
  const state = useData(db.catalog, [version]);
  return (
    <>
      <header className="intro">
        <div>
          <p className="eyebrow">FOLIO SUPPLY / STATIONERY</p>
          <h1>{home ? "Paper for everyday work." : "The collection"}</h1>
          <p>Clothbound notebooks, desk paper and undated planners.</p>
        </div>
        <div className="imprint" aria-hidden="true">
          F<span>S</span>
        </div>
      </header>
      <section>
        <div className="sectionhead">
          <h2>{home ? "Shop the collection" : "Paper goods"}</h2>
          <label>
            Find a product
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search stationery"
            />
          </label>
        </div>
        <Result state={state}>
          {(rows) => {
            const groups = new Map();
            for (const p of rows) {
              if (!groups.has(p.product)) groups.set(p.product, []);
              groups.get(p.product).push(p);
            }
            const filtered = [...groups.values()].filter((items) =>
              items[0].title.toLowerCase().includes(search.toLowerCase()),
            );
            return filtered.length ? (
              <div className="grid">
                {filtered.map((items) => (
                  <a
                    className="card"
                    key={items[0].product}
                    href={"/products/" + items[0].product}
                  >
                    <Art product={items[0].product} />
                    <div className="caption">
                      <h3>{items[0].title}</h3>
                      <span>
                        {items.length > 1 ? "From " : ""}
                        {money(Math.min(...items.map((p) => p.unit)))}
                      </span>
                    </div>
                    <small>{items.map((p) => p.variant).join(" · ")}</small>
                  </a>
                ))}
              </div>
            ) : (
              <p>No matching stationery.</p>
            );
          }}
        </Result>
      </section>
    </>
  );
}
export function Product({ id, version, refresh }) {
  const state = useData(
    async () => (await db.catalog()).filter((p) => p.product === id),
    [id, version],
  );
  const [selected, choose] = useState(""),
    [qty, setQty] = useState(1);
  const action = useAction(refresh);
  return (
    <Result state={state}>
      {(rows) => {
        if (!rows.length) return <h1>Product unavailable</h1>;
        const p = rows.find((r) => r.sku === selected) ?? rows[0];
        return (
          <>
            <a href="/products">← Collection</a>
            <div className="detail">
              <Gallery sku={p.sku} product={id} version={version} />
              <section>
                <p className="eyebrow">PAPER GOODS</p>
                <h1>{p.title}</h1>
                <p className="price">{money(p.unit)}</p>
                <label>
                  Edition
                  <select
                    value={p.sku}
                    onChange={(e) => choose(e.target.value)}
                  >
                    {rows.map((v) => (
                      <option key={v.sku} value={v.sku}>
                        {v.variant}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Quantity
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                  />
                </label>
                <p>
                  {p.available ? "Available to order" : "Currently unavailable"}
                </p>
                <button
                  className="primary"
                  disabled={!p.available || action.busy || qty < 1 || qty > 20}
                  onClick={() =>
                    action.run(() => db.change(p.sku, qty), "Added to basket.")
                  }
                >
                  Add to basket
                </button>{" "}
                <a href="/cart">View basket</a>
                <Feedback action={action} />
              </section>
            </div>
            <Reviews key={p.sku} sku={p.sku} version={version} />
          </>
        );
      }}
    </Result>
  );
}
function Reviews({ sku, version }) {
  const s = useData(() => db.reviews(sku), [sku, version]);
  const a = useAction();
  return (
    <section>
      <h2>Reader reviews</h2>
      <Result state={s}>
        {(rows) =>
          rows.length ? (
            <ul>
              {rows.map((r) => (
                <li key={r.id}>
                  {r.rating}/5 · {r.body}
                </li>
              ))}
            </ul>
          ) : (
            <p>No published reviews for this edition.</p>
          )
        }
      </Result>
      {db.identity() === "visitor" ? (
        <a href="/auth">Sign in to review</a>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.target);
            a.run(
              () => db.review(sku, Number(f.get("rating")), f.get("body")),
              "Submitted for moderation.",
            );
          }}
        >
          <label>
            Rating
            <select name="rating">
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <label>
            Review
            <textarea required minLength="3" maxLength="500" name="body" />
          </label>
          <button disabled={a.busy}>Submit review</button>
          <Feedback action={a} />
        </form>
      )}
    </section>
  );
}

function Gallery({ sku, product, version }) {
  const s = useData(() => db.images(sku), [sku, version]);
  if (!s.data?.length) return <Art product={product} />;
  return (
    <div className="gallery">
      {s.data.map((img) => (
        <img
          loading="lazy"
          key={img.slot}
          alt={product + " edition, view " + img.slot}
          src={"data:image/webp;base64," + img.encoded.replace(/\s/g, "")}
        />
      ))}
    </div>
  );
}
