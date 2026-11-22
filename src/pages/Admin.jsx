import React, { useState } from "react";
import * as db from "@store";
import {
  Feedback,
  Lines,
  Pager,
  Result,
  money,
  useData,
  useAction,
} from "../ui.jsx";
function CatalogRow({ p, action }) {
  return (
    <>
      <form
        className="panel"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.target);
          action.run(
            () =>
              db.editSku(
                p.sku,
                p.revision,
                Number(f.get("price")),
                Number(f.get("discount")),
                f.has("available"),
              ),
            "Catalog updated.",
          );
        }}
      >
        <h3>
          {p.title} · {p.variant}
        </h3>
        <small>{p.sku}</small>
        <label>
          Price in paise
          <input
            name="price"
            type="number"
            defaultValue={p.price}
            min="1"
            max="10000000"
            required
          />
        </label>
        <label>
          Discount in basis points
          <input
            name="discount"
            type="number"
            defaultValue={p.discount}
            min="0"
            max="9999"
            required
          />
        </label>
        <label>
          <input
            type="checkbox"
            name="available"
            defaultChecked={p.available}
          />{" "}
          Available
        </label>
        <button disabled={action.busy}>Save edition</button>
      </form>
      <details>
        <summary>Manage images for {p.sku}</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.target),
              slot = Number(f.get("slot"));
            const remove = e.nativeEvent.submitter?.value === "remove";
            action.run(
              () =>
                remove
                  ? db.removeImage(p.sku, slot)
                  : db.uploadImage(p.sku, slot, f.get("file")),
              "Image slot updated.",
            );
          }}
        >
          <label>
            Image position
            <select name="slot">
              {[1, 2, 3, 4].map((i) => (
                <option key={i}>{i}</option>
              ))}
            </select>
          </label>
          <label>
            Product image
            <input
              type="file"
              name="file"
              accept="image/png,image/jpeg,image/webp"
            />
          </label>
          <button disabled={action.busy}>Save image</button>{" "}
          <button value="remove" disabled={action.busy}>
            Clear slot
          </button>
        </form>
      </details>
    </>
  );
}
function OrderRow({ o, action }) {
  return (
    <details className="panel">
      <summary>
        {o.reference} · {o.method} · {o.payment} · {o.fulfilment}
        {o.archived ? " · archived" : ""}
      </summary>
      <Lines lines={o.lines} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.target);
          action.run(
            () => db.staffAction(o.id, f.get("action"), f.get("reason")),
            "Order updated.",
          );
        }}
      >
        <label>
          Action
          <select name="action">
            {[
              "packing",
              "shipped",
              "delivered",
              "returned",
              "cancelled",
              "archive",
              "cod-collected",
              "request-refund",
            ].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Staff note
          <input name="reason" minLength="3" maxLength="200" required />
        </label>
        <button disabled={action.busy}>Record action</button>
      </form>
    </details>
  );
}
export default function Admin({ version, refresh }) {
  const [section, select] = useState("orders"),
    [page, set] = useState(0);
  const a = useAction(refresh);
  const staff = db.identity() === "staff",
    s = useData(
      () => (staff ? db.adminList(section, page) : []),
      [section, page, version, staff],
    );
  if (!staff)
    return (
      <>
        <h1>Studio administration</h1>
        <a href="/auth">Open the synthetic staff profile</a>
      </>
    );
  return (
    <>
      <h1>Studio administration</h1>
      <p>These records belong to this browser’s isolated studio.</p>
      <nav className="tabs" aria-label="Admin sections">
        {[
          "orders",
          "exceptions",
          "catalog",
          "reviews",
          "contact",
          "newsletter",
          "events",
        ].map((x) => (
          <button
            aria-pressed={section === x}
            key={x}
            onClick={() => {
              select(x);
              set(0);
            }}
          >
            {x}
          </button>
        ))}
      </nav>
      <h2>{section}</h2>
      {section === "exceptions" && (
        <p>Merchant inquiry is unconfigured. Pending orders require review.</p>
      )}
      {section === "catalog" && (
        <details>
          <summary>Add edition</summary>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.target);
              a.run(
                () =>
                  db.createSku(
                    ["sku", "product", "title", "variant"]
                      .map((k) => f.get(k))
                      .concat(Number(f.get("price"))),
                  ),
                "Edition added.",
              );
            }}
          >
            {["sku", "product", "title", "variant", "price"].map((k) => (
              <label key={k}>
                {k}
                <input
                  name={k}
                  required
                  type={k === "price" ? "number" : "text"}
                />
              </label>
            ))}
            <button>Add catalog edition</button>
          </form>
        </details>
      )}
      <Feedback action={a} />
      <Result state={s}>
        {(rows) => (
          <>
            {rows.length === 0 && <p>No records on this page.</p>}
            {rows.map((r, i) =>
              section === "catalog" ? (
                <CatalogRow key={r.sku + "-" + r.revision} p={r} action={a} />
              ) : section === "orders" ? (
                <OrderRow key={r.id} o={r} action={a} />
              ) : (
                <article className="panel" key={r.id ?? i}>
                  {Object.entries(r).map(([k, v]) => (
                    <span className="field" key={k}>
                      {k}{" "}
                      <strong>
                        {k === "amount" ? money(v) : String(v ?? "—")}
                      </strong>
                    </span>
                  ))}
                  {section === "reviews" && !r.published && (
                    <button
                      onClick={() =>
                        a.run(() => db.moderate(r.id), "Review published.")
                      }
                    >
                      Publish review
                    </button>
                  )}
                  {["contact", "newsletter"].includes(section) && (
                    <button
                      onClick={() =>
                        a.run(
                          () => db.removeMessage(r.id),
                          "Submission removed.",
                        )
                      }
                    >
                      Remove submission
                    </button>
                  )}
                </article>
              ),
            )}
            <Pager page={page} set={set} count={rows.length} />
          </>
        )}
      </Result>
    </>
  );
}
