import { createClient } from "@supabase/supabase-js";
import { publicBinding } from "../../config/staging.js";
import { hostedAuth } from "./auth.js";
const binding = publicBinding("staging");
if (location.origin !== binding.origin)
  throw Error("Unapproved staging origin");
const client = createClient(binding.url, binding.publishable, {
  db: { schema: "folio" },
  auth: { flowType: "pkce" },
});
export const demo = false;
export const auth = hostedAuth(client.auth, binding.origin);
let session = await auth.session(),
  mode = "visitor";
const read = async (promise) => {
  const { error, data } = await promise;
  if (error) throw Error("Store request could not be completed");
  return data;
};
async function identityChanged(next) {
  session = next;
  const current = next?.user.id;
  mode = next ? (next.user.is_anonymous ? "guest" : "customer") : "visitor";
  if (
    next &&
    (await read(client.rpc("is_staff"))) &&
    session?.user.id === current
  )
    mode = "staff";
  window.dispatchEvent(new Event("folio-session"));
}
await identityChanged(session);
client.auth.onAuthStateChange((_event, next) => {
  setTimeout(
    () =>
      identityChanged(next).catch(() => {
        mode = "visitor";
        window.dispatchEvent(new Event("folio-session"));
      }),
    0,
  );
});
export const identity = () => mode;
export const signOut = () => auth.logout();
const localKey = "folio.staging." + binding.project;
const guestKey = localKey + ".basket";
const localBag = () =>
  JSON.parse(localStorage.getItem(guestKey) ?? "null") ?? {
    token: crypto.randomUUID(),
    changes: {},
  };
const lock = (fn) => navigator.locks.request(localKey, fn);
async function merge() {
  const pending = localBag();
  if (!session || !Object.keys(pending.changes).length) return;
  await read(
    client.rpc("change_cart", {
      token: pending.token,
      changes: pending.changes,
    }),
  );
  localStorage.removeItem(guestKey);
}
export async function signIn() {
  session = await auth.session();
  await lock(merge);
}
export const catalog = async () =>
  (
    await read(
      client
        .from("catalog")
        .select("sku,product,title,variant,price,discount,available,revision")
        .order("product"),
    )
  ).map((p) => ({
    ...p,
    unit: Math.max(
      1,
      Math.floor((p.price * (10000 - p.discount) + 5000) / 10000),
    ),
  }));
export async function basket() {
  if (session) {
    await lock(merge);
    return read(client.rpc("my_basket"));
  }
  const { changes } = localBag();
  return (await catalog())
    .filter((p) => changes[p.sku])
    .map((p) => ({
      sku: p.sku,
      title: p.title,
      variant: p.variant,
      available: p.available,
      unit: p.unit,
      qty: changes[p.sku],
    }))
    .sort((a, b) => a.sku.localeCompare(b.sku));
}
export const change = (sku, delta) =>
  lock(async () => {
    if (session) {
      await merge();
      return read(
        client.rpc("change_cart", {
          token: crypto.randomUUID(),
          changes: { [sku]: delta },
        }),
      );
    }
    const b = localBag(),
      n = (b.changes[sku] ?? 0) + delta;
    if (!Number.isInteger(n) || n < 0 || n > 20)
      throw Error("Choose up to 20 per item.");
    if (n) b.changes[sku] = n;
    else delete b.changes[sku];
    b.token = crypto.randomUUID();
    localStorage.setItem(guestKey, JSON.stringify(b));
  });
export const pricePolicy = async () => {
  const p = await read(
    client.from("price_policy").select("shipping_paise,added_tax_bps").single(),
  );
  return { shipping: p.shipping_paise, taxBps: p.added_tax_bps };
};
const attemptKey = () => localKey + ".attempt." + session?.user.id;
export const pendingAttempt = () =>
  JSON.parse(sessionStorage.getItem(attemptKey()) ?? "null");
export const place = (expected, _channel, terms, address) =>
  lock(async () => {
    if (!session) {
      const data = await auth.guest();
      session = data.session;
    }
    await merge();
    const saved = pendingAttempt() ?? {
      attempt: crypto.randomUUID(),
      expected,
      terms,
      address,
    };
    sessionStorage.setItem(attemptKey(), JSON.stringify(saved));
    const res = await fetch("/api/create-order", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + session.access_token,
      },
      body: JSON.stringify(saved),
    });
    if (!res.ok) {
      if (res.status === 409) sessionStorage.removeItem(attemptKey());
      throw Error(
        "Checkout is unavailable. Review your orders before retrying.",
      );
    }
    const response = await res.json();
    sessionStorage.removeItem(attemptKey());
    if (response.encRequest) {
      const url =
        "https://test.ccavenue.com/transaction/transaction.do?command=initiateTransaction";
      if (response.endpoint !== url) throw Error("Unapproved destination");
      const form = document.createElement("form");
      form.method = "post";
      form.action = url;
      for (const k of ["access_code", "encRequest"]) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = k;
        input.value = response[k];
        form.append(input);
      }
      document.body.append(form);
      form.submit();
    }
    return response.id;
  });
export const orders = (page = 0) =>
  read(
    client
      .from("orders")
      .select("id,reference,payment,phase,fulfilment,amount,created_at")
      .eq("owner", session.user.id)
      .order("created_at", { ascending: false })
      .order("id")
      .range(page * 20, page * 20 + 19),
  );
export const order = (id) =>
  read(
    client
      .from("orders")
      .select(
        "id,reference,payment,phase,fulfilment,amount,lines,destination,method,shipping_fee,subtotal,tax",
      )
      .eq("id", id)
      .eq("owner", session.user.id)
      .maybeSingle(),
  );
export const reviews = (sku) =>
  read(
    client
      .from("reviews")
      .select("id,body,rating")
      .eq("sku", sku)
      .eq("published", true)
      .order("id", { ascending: false })
      .limit(30),
  );
export const review = (sku, rating, body) =>
  read(
    client
      .from("reviews")
      .insert({ owner: session.user.id, sku, rating, body }),
  );
export const profile = () =>
  read(
    client
      .from("profiles")
      .select("label")
      .eq("owner", session.user.id)
      .single(),
  );
export const rename = (label) =>
  read(client.from("profiles").update({ label }).eq("owner", session.user.id));
export const simulate = () => {
  throw Error("Simulation unavailable");
};
export const submit = async (kind, email, body, consent) => {
  const res = await fetch("/api/submission", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, email, body, consent }),
  });
  if (!res.ok) throw Error("Submission unavailable");
};
export const staffAction = (target_id, action, reason) =>
  action === "request-refund"
    ? read(client.rpc("request_refund", { target_id, reason }))
    : read(client.rpc("staff_action", { target_id, action, reason }));
export const moderate = (id) =>
  read(client.from("reviews").update({ published: true }).eq("id", id));
export const removeMessage = (id) =>
  read(client.from("inbox").delete().eq("id", id));
export const createSku = ([sku, product, title, variant, price]) =>
  read(client.from("catalog").insert({ sku, product, title, variant, price }));
export async function editSku(sku, revision, price, discount, available) {
  await read(
    client
      .from("catalog")
      .update({ price, discount, available })
      .eq("sku", sku)
      .eq("revision", revision)
      .select("sku")
      .single(),
  );
}
export function adminList(section, page) {
  const filters = {
    orders: () =>
      client
        .from("orders")
        .select("id,reference,payment,phase,fulfilment,method,archived,lines")
        .order("created_at", { ascending: false })
        .order("id"),
    exceptions: () =>
      client
        .from("orders")
        .select("reference,payment,checks,next_check")
        .eq("method", "online")
        .neq("phase", "resolved")
        .order("created_at")
        .order("id"),
    catalog: () =>
      client
        .from("catalog")
        .select("sku,product,title,variant,price,discount,available,revision")
        .order("sku"),
    reviews: () =>
      client
        .from("reviews")
        .select("id,sku,rating,body,published")
        .order("id", { ascending: false }),
    events: () =>
      client
        .from("events")
        .select("order_id,kind,note,recorded_at")
        .order("id", { ascending: false }),
  };
  const query = ["contact", "newsletter"].includes(section)
    ? client
        .from("inbox")
        .select("id,email,message,created_at")
        .eq("kind", section)
        .order("id", { ascending: false })
    : filters[section]();
  return read(query.range(20 * page, 20 * page + 19));
}
export const images = (edition) => read(client.rpc("images", { edition }));
export const removeImage = (edition, image_slot) =>
  read(client.rpc("remove_image", { edition, image_slot }));
export async function uploadImage(sku, slot, file) {
  if (!file || file.size > 2097152) throw Error("Use an image under 2 MB.");
  const res = await fetch(
    "/api/catalog-image?" + new URLSearchParams({ sku, slot }),
    {
      method: "POST",
      headers: { Authorization: "Bearer " + session.access_token },
      body: file,
    },
  );
  if (!res.ok) throw Error("Image could not be saved");
}
