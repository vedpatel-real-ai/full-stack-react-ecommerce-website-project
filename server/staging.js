import { decrypt, encrypt, requestFields, validateStatus } from "./gateway.js";
// Reviewed project bindings belong in a separate release after sandbox sign-off.
import { approvedBindings } from "../config/staging.js";
export function stagingConfig(env, bindings = approvedBindings) {
  const project = env.STAGING_PROJECT_REF,
    origin = env.STAGING_ORIGIN;
  if (
    !bindings.some((b) => b.project === project && b.origin === origin) ||
    !/^https:\/\/[a-z\d]{20}\.supabase\.co$/.test(env.STAGING_SUPABASE_URL) ||
    env.STAGING_SUPABASE_URL !== "https://" + project + ".supabase.co" ||
    !env.STAGING_SUPABASE_SERVICE_KEY ||
    !env.CCAVENUE_SANDBOX_WORKING_KEY ||
    !env.CCAVENUE_SANDBOX_ACCESS_CODE ||
    !env.CCAVENUE_SANDBOX_MERCHANT_ID
  )
    throw Error("Sandbox release gate closed");
  return {
    project,
    url: env.STAGING_SUPABASE_URL,
    origin,
    serviceKey: env.STAGING_SUPABASE_SERVICE_KEY,
    merchant: env.CCAVENUE_SANDBOX_MERCHANT_ID,
    access: env.CCAVENUE_SANDBOX_ACCESS_CODE,
    key: env.CCAVENUE_SANDBOX_WORKING_KEY,
  };
}
export function stagingStore(config, transport = fetch) {
  async function read(path, options) {
    const res = await transport(config.url + path, {
      ...options,
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const details = await res.json().catch(() => ({}));
      if (
        details.code === "P0001" &&
        details.message === "Basket changed. Review again."
      )
        throw Error("Review basket again");
      throw Error("Backend request rejected");
    }
    return res.status === 204 ? null : res.json();
  }
  const headers = {
    apikey: config.serviceKey,
    Authorization: "Bearer " + config.serviceKey,
    "Content-Type": "application/json",
    "Content-Profile": "folio",
    "Accept-Profile": "folio",
  };
  const rpc = (name, args) =>
    read("/rest/v1/rpc/" + name, {
      method: "POST",
      headers,
      body: JSON.stringify(args),
    });
  return {
    merchant: config.merchant,
    staff: (token) =>
      read("/rest/v1/rpc/is_staff", {
        method: "POST",
        headers: { ...headers, Authorization: token },
        body: "{}",
      }),
    image: (args) => rpc("replace_image", args),
    submit: (args) => rpc("submit_message", args),
    async user(token) {
      if (!/^Bearer [^\s]{1,4096}$/.test(token ?? ""))
        throw Error("Authentication required");
      const user = await read("/auth/v1/user", {
        headers: { apikey: config.serviceKey, Authorization: token },
      });
      if (!/^[\da-f-]{36}$/i.test(user.id)) throw Error("Invalid account");
      return user.id;
    },
    checkout: (args) => rpc("quoted_checkout", args),
    start: (who, target_id) => rpc("start_gateway", { who, target_id }),
    async order(column, value) {
      if (!["id", "reference"].includes(column)) throw Error("Invalid lookup");
      const rows = await read(
        "/rest/v1/orders?select=id,reference,amount,owner,method,payment,phase&" +
          column +
          "=eq." +
          encodeURIComponent(value),
        { headers },
      );
      if (rows.length !== 1) throw Error("Order unavailable");
      return rows[0];
    },
    record: (args) => rpc("evidence", args),
    async claim(batch_size) {
      const rows = await rpc("claim_due", { batch_size });
      return Promise.all(rows.map((r) => this.order("reference", r.reference)));
    },
    async exception(reference) {
      console.warn(
        JSON.stringify({ event: "reconciliation_pending", reference }),
      );
    },
  };
}
export async function createSandboxOrder(req, store, config) {
  if (
    req.method !== "POST" ||
    req.headers.origin !== config.origin ||
    req.headers["content-type"]?.split(";")[0] !== "application/json"
  )
    throw Error("Invalid request");
  const owner = await store.user(req.headers.authorization);
  if (typeof req.body !== "string" || Buffer.byteLength(req.body) > 16384)
    throw Error("Invalid body");
  const body = JSON.parse(req.body);
  if (
    Object.keys(body).sort().join() !== "address,attempt,expected,terms" ||
    !Array.isArray(body.expected) ||
    body.expected.length > 40 ||
    !/^([\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12})$/i.test(
      body.attempt,
    )
  )
    throw Error("Invalid checkout");
  const id = await store.checkout({
    who: owner,
    request_id: body.attempt,
    expected: body.expected,
    address: body.address,
    channel: "online",
    terms: body.terms,
  });
  const order = await store.order("id", id);
  if (order.owner !== owner || order.method !== "online")
    throw Error("Order unavailable");
  if (
    order.payment !== "pending" ||
    order.phase !== "awaiting" ||
    !(await store.start(owner, id))
  )
    return { id, review: true };
  return {
    id,
    endpoint:
      "https://test.ccavenue.com/transaction/transaction.do?command=initiateTransaction",
    access_code: config.access,
    encRequest: encrypt(
      requestFields(order, config.merchant, config.origin),
      config.key,
    ),
  };
}
export async function sandboxCallback(req, store, config, inquire) {
  if (
    req.method !== "POST" ||
    req.headers["content-type"]?.split(";")[0] !==
      "application/x-www-form-urlencoded"
  )
    throw Error("Invalid callback");
  const input = decrypt(req.body, config.key);
  if (!/^F\d{1,19}$/.test(input.order_id)) throw Error("Invalid reference");
  const order = await store.order("reference", input.order_id);
  validateStatus(input, order, config.merchant);
  if (inquire) {
    const evidence = validateStatus(
      await inquire(order.reference, { signal: AbortSignal.timeout(5000) }),
      order,
      config.merchant,
    );
    await store.record(evidence);
  }
  return { status: 303, location: "/orders/" + order.id };
}
