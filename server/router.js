import { createHmac, randomUUID } from "node:crypto";
import {
  stagingConfig,
  stagingStore,
  createSandboxOrder,
  sandboxCallback,
} from "./staging.js";
import { imageBytes } from "./media.js";
async function bounded(req, limit = 16384) {
  if (Number(req.headers.get("content-length")) > limit) throw RangeError();
  const reader = req.body?.getReader();
  if (!reader) throw Error("Missing request");
  let length = 0;
  const chunks = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > limit) {
      await reader.cancel();
      throw RangeError();
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}
const reply = (status, data, headers = {}) =>
  new Response(data === null ? null : JSON.stringify(data), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json",
      ...headers,
    },
  });
// Bind only on a separately approved sandbox host. The public API uses a different entry point.
export function sandboxRouter({
  env,
  configure = stagingConfig,
  connect = stagingStore,
  inquire,
  clientAddress,
}) {
  return async (req) => {
    const correlation = randomUUID();
    let config;
    try {
      config = configure(env);
    } catch {
      return reply(503, { error: "Sandbox unavailable", correlation });
    }
    const url = new URL(req.url);
    if (url.origin !== config.origin)
      return reply(403, { error: "Origin unavailable", correlation });
    if (req.method !== "POST")
      return reply(
        405,
        { error: "POST required", correlation },
        { allow: "POST" },
      );
    if (
      ![
        "/api/create-order",
        "/api/payment-response",
        "/api/submission",
        "/api/catalog-image",
      ].includes(url.pathname)
    )
      return reply(404, { error: "Unknown route", correlation });
    if (
      url.pathname !== "/api/payment-response" &&
      req.headers.get("origin") !== config.origin
    )
      return reply(403, { error: "Origin unavailable", correlation });
    try {
      const store = connect(config);
      if (url.pathname === "/api/catalog-image") {
        const token = req.headers.get("authorization"),
          who = await store.user(token);
        if (!(await store.staff(token)))
          return reply(403, { error: "Staff required", correlation });
        const sku = url.searchParams.get("sku"),
          slot = Number(url.searchParams.get("slot"));
        if (
          !/^[a-z0-9-]{1,40}$/.test(sku ?? "") ||
          !Number.isInteger(slot) ||
          slot < 1 ||
          slot > 4
        )
          throw Error("Invalid image slot");
        const raster = await imageBytes(await bounded(req, 2097152));
        await store.image({
          who,
          edition: sku,
          image_slot: slot,
          encoded: raster.toString("base64"),
        });
        return reply(200, { saved: true });
      }
      const input = {
        method: req.method,
        headers: Object.fromEntries(req.headers),
        body: (await bounded(req)).toString("utf8"),
      };
      if (url.pathname === "/api/create-order") {
        if (!req.headers.get("authorization"))
          return reply(401, { error: "Sign in required", correlation });
        return reply(200, await createSandboxOrder(input, store, config));
      }
      if (url.pathname === "/api/submission") {
        const address = clientAddress?.(req);
        if (!address || !env.SUBMISSION_HASH_KEY)
          return reply(503, {
            error: "Submission service unavailable",
            correlation,
          });
        if (input.headers["content-type"]?.split(";")[0] !== "application/json")
          return reply(415, { error: "JSON required", correlation });
        const data = JSON.parse(input.body);
        if (
          typeof data.body !== "string" ||
          typeof data.email !== "string" ||
          data.consent !== true ||
          !["contact", "newsletter"].includes(data.kind)
        )
          throw Error("Invalid submission");
        const hash = createHmac("sha256", env.SUBMISSION_HASH_KEY)
          .update(address)
          .digest("hex");
        await store.submit({
          category: data.kind,
          sender: data.email,
          content: data.body,
          agreed: true,
          subject_hash: hash,
        });
        return reply(202, { received: true });
      }
      const result = await sandboxCallback(input, store, config, inquire);
      return reply(result.status, null, { location: result.location });
    } catch (error) {
      if (error instanceof RangeError)
        return reply(413, { error: "Request too large", correlation });
      if (error.message === "Review basket again")
        return reply(409, { error: "Review the basket again", correlation });
      return reply(400, {
        error: "Request could not be confirmed",
        correlation,
      });
    }
  };
}
