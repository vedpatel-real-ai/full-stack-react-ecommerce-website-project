import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  encrypt,
  decrypt,
  fields,
  paise,
  requestFields,
  validateStatus,
  reconcile,
} from "../server/gateway.js";
import {
  createSandboxOrder,
  sandboxCallback,
  stagingConfig,
} from "../server/staging.js";
import disabled from "../api/[...path].js";
const config = {
  key: "local protocol fixture",
  merchant: "fixture",
  access: "local",
  origin: "https://studio.example.invalid",
};
const order = {
  reference: "F1234",
  amount: 12345,
  owner: randomUUID(),
  id: randomUUID(),
  method: "online",
  payment: "pending",
  phase: "awaiting",
};
const input = {
  ...requestFields(order, config.merchant, config.origin),
  tracking_id: "local-fixture",
  order_status: "Success",
};
const req = {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({ encResp: encrypt(input, config.key) }).toString(),
};
test("short gateway reference and two-decimal INR values round trip with the fixture key", () => {
  assert.equal(input.amount, "123.45");
  assert.equal(paise(input.amount), order.amount);
  assert.deepEqual({ ...decrypt(req.body, config.key) }, input);
  assert.throws(() =>
    requestFields(
      { ...order, reference: randomUUID() },
      config.merchant,
      config.origin,
    ),
  );
  for (const value of ["0.001", "1e3", "-1.00", "NaN", "Infinity", "1,000.00"])
    assert.throws(() => paise(value));
});
test("reject duplicate or oversized form, malformed ciphertext and missing contract fields", () => {
  for (const b of [
    req.body + "&" + req.body,
    "encResp=x",
    "encResp=" + "a".repeat(20000),
    "other=11",
    "encResp=00",
    "encResp=%zz",
  ])
    assert.throws(() => decrypt(b, config.key));
  assert.throws(() => fields("order_id=F1&order_id=F2"));
  for (const [k, v] of Object.entries({
    merchant_id: "other",
    currency: "USD",
    order_id: "F9",
    amount: "123.46",
    order_status: "Unknown",
    tracking_id: "",
  }))
    assert.throws(() =>
      validateStatus({ ...input, [k]: v }, order, config.merchant),
    );
});
test("return only redirects to an owned-order view until a separate inquiry confirms status", async () => {
  const records = [],
    store = { order: async () => order, record: async (e) => records.push(e) };
  assert.deepEqual(await sandboxCallback(req, store, config), {
    status: 303,
    location: "/orders/" + order.id,
  });
  assert.equal(records.length, 0);
  await sandboxCallback(req, store, config, async () => ({
    ...input,
    order_status: "Failure",
  }));
  assert.equal(records[0].outcome, "declined");
  await assert.rejects(
    sandboxCallback({ ...req, method: "GET" }, store, config),
  );
});
test("checkout enforces request shape, resolved account, origin and settled-order resume", async () => {
  const body = {
    attempt: randomUUID(),
    expected: [],
    address: "Sample studio",
    terms: { shipping: 0, taxBps: 0 },
  };
  const request = {
    method: "POST",
    headers: {
      origin: config.origin,
      "content-type": "application/json",
      authorization: "Bearer fixture",
    },
    body: JSON.stringify(body),
  };
  const store = {
    start: async () => true,
    user: async () => order.owner,
    checkout: async (args) => {
      assert.equal(args.who, order.owner);
      return order.id;
    },
    order: async () => order,
  };
  assert.match(
    (await createSandboxOrder(request, store, config)).endpoint,
    /^https:\/\/test\.ccavenue\.com\//,
  );
  for (const bad of [
    { ...request, method: "GET" },
    { ...request, headers: {} },
    { ...request, body: JSON.stringify({ ...body, amount: 1 }) },
    { ...request, body: "a".repeat(17000) },
  ])
    await assert.rejects(createSandboxOrder(bad, store, config));
  assert.deepEqual(
    await createSandboxOrder(
      request,
      { ...store, order: async () => ({ ...order, payment: "captured" }) },
      config,
    ),
    { id: order.id, review: true },
  );
});
test("no environment enables a merchant on the public deployment", () => {
  assert.throws(
    () =>
      stagingConfig({ NODE_ENV: "production", STAGING_PROJECT_REF: "example" }),
    /closed/,
  );
  let status;
  disabled(
    {},
    {
      setHeader() {},
      status(code) {
        status = code;
        return this;
      },
      json() {},
    },
  );
  assert.equal(status, 503);
});
test("unconfigured reconciliation consumes no retries and unavailable inquiries retain exceptions", async () => {
  const records = [],
    errors = [],
    store = {
      merchant: config.merchant,
      claim: async () => [order],
      record: async (e) => records.push(e),
      exception: async (ref) => errors.push(ref),
    };
  assert.deepEqual(await reconcile(store), {
    state: "not configured",
    checked: 0,
  });
  await reconcile(store, async () => {
    throw Error("timeout");
  });
  assert.deepEqual(errors, [order.reference]);
  assert.equal(records.length, 0);
  await reconcile(store, async () => input);
  assert.equal(records[0].outcome, "captured");
});
