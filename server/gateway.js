import { createCipheriv, createDecipheriv, createHash } from "node:crypto";
const iv = Buffer.from(Array.from({ length: 16 }, (_, i) => i));
function codec(key, decrypt) {
  if (!key) throw Error("Missing working key");
  const digest = createHash("md5").update(key, "utf8").digest();
  return (decrypt ? createDecipheriv : createCipheriv)(
    "aes-128-cbc",
    digest,
    iv,
  );
}
export function encrypt(fields, key) {
  const cipher = codec(key, false);
  return Buffer.concat([
    cipher.update(new URLSearchParams(fields).toString(), "utf8"),
    cipher.final(),
  ]).toString("hex");
}
export function fields(raw) {
  if (
    typeof raw !== "string" ||
    Buffer.byteLength(raw) > 16384 ||
    /%(?![0-9a-f]{2})/i.test(raw)
  )
    throw Error("Invalid form");
  const input = new URLSearchParams(raw);
  const result = Object.create(null);
  for (const [name, value] of input) {
    if (!name || Object.hasOwn(result, name)) throw Error("Ambiguous form");
    result[name] = value;
  }
  return result;
}
export function decrypt(form, key) {
  const { encResp, ...extra } = fields(form);
  if (
    Object.keys(extra).length ||
    !/^([\da-f]{32}){1,480}$/i.test(encResp ?? "")
  )
    throw Error("Invalid response");
  const cipher = codec(key, true);
  return fields(
    Buffer.concat([
      cipher.update(Buffer.from(encResp, "hex")),
      cipher.final(),
    ]).toString("utf8"),
  );
}
export function paise(value) {
  if (typeof value !== "string" || !/^\d{1,10}\.\d{2}$/.test(value))
    throw Error("Invalid amount");
  return Number(value.replace(".", ""));
}
export function requestFields(order, merchant, origin) {
  if (
    !/^F\d{1,19}$/.test(order.reference) ||
    !Number.isSafeInteger(order.amount) ||
    order.amount < 1
  )
    throw Error("Invalid order");
  const redirect = new URL("/api/payment-response", origin);
  if (redirect.protocol !== "https:") throw Error("HTTPS required");
  return {
    order_id: order.reference,
    amount:
      Math.floor(order.amount / 100) +
      "." +
      String(order.amount % 100).padStart(2, "0"),
    currency: "INR",
    merchant_id: merchant,
    redirect_url: redirect.href,
    cancel_url: redirect.href,
    language: "EN",
  };
}
export function validateStatus(input, order, merchant) {
  const statuses = new Map([
    ["Success", "captured"],
    ["Failure", "declined"],
    ["Aborted", "cancelled"],
  ]);
  if (
    input.merchant_id !== merchant ||
    !merchant ||
    input.currency !== "INR" ||
    input.order_id !== order.reference ||
    paise(input.amount) !== order.amount ||
    !statuses.has(input.order_status) ||
    !/^[A-Za-z0-9_-]{1,100}$/.test(input.tracking_id ?? "")
  )
    throw Error("Unconfirmed evidence");
  return {
    gateway_ref: order.reference,
    paid_amount: order.amount,
    currency: "INR",
    transaction_ref: input.tracking_id,
    outcome: statuses.get(input.order_status),
  };
}
// No HTTP transport is shipped for merchant status inquiry pending the current kit.
export async function reconcile(store, inquiry) {
  if (!inquiry) return { state: "not configured", checked: 0 };
  const due = await store.claim(25);
  let checked = 0;
  for (const order of due) {
    try {
      const proof = await inquiry(order.reference, {
        signal: AbortSignal.timeout(5000),
      });
      await store.record(validateStatus(proof, order, store.merchant));
      checked++;
    } catch {
      await store.exception(order.reference, "confirmation unavailable");
    }
  }
  return { state: "checked", checked };
}
