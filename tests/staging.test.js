import { test } from "node:test";
import assert from "node:assert/strict";
import { hostedAuth } from "../src/staging/auth.js";
import { publicBinding } from "../config/staging.js";
import { sandboxRouter } from "../server/router.js";
import { stagingStore } from "../server/staging.js";
test("hosted account conversion updates the existing guest and separates confirmed-password setup", async () => {
  const calls = [];
  let guest = true;
  const api = {
    getSession: async () => ({
      data: { session: { user: { is_anonymous: guest } } },
    }),
  };
  for (const k of [
    "signInAnonymously",
    "signInWithPassword",
    "signUp",
    "resetPasswordForEmail",
    "updateUser",
    "signOut",
  ])
    api[k] = async (...args) => {
      calls.push([k, ...args]);
      return { data: {} };
    };
  const auth = hostedAuth(api, "https://example.invalid");
  await auth.guest();
  await auth.signup("a@example.invalid", "synthetic-pass");
  assert.deepEqual(calls.at(-1), [
    "updateUser",
    { email: "a@example.invalid" },
    { emailRedirectTo: "https://example.invalid/auth" },
  ]);
  await auth.password("synthetic-pass");
  guest = false;
  await auth.signup("a@example.invalid", "synthetic-pass");
  await auth.login("a@example.invalid", "synthetic-pass");
  await auth.reset("a@example.invalid");
  await auth.logout();
  assert.deepEqual(
    calls.map((c) => c[0]),
    [
      "signInAnonymously",
      "updateUser",
      "updateUser",
      "signUp",
      "signInWithPassword",
      "resetPasswordForEmail",
      "signOut",
    ],
  );
});
test("default stage entry points cannot open a merchant or contact a database", async () => {
  assert.equal(publicBinding("production"), null);
  assert.throws(() => publicBinding("staging"));
  const run = sandboxRouter({
    env: { NODE_ENV: "production" },
    connect() {
      assert.fail("network");
    },
  });
  assert.equal(
    (await run(new Request("https://example.invalid/api/create-order"))).status,
    503,
  );
});
test("staging router validates origin, method, identity presence, bounded payload and form consent", async () => {
  const origin = "https://example.invalid",
    records = [];
  const run = sandboxRouter({
    env: { SUBMISSION_HASH_KEY: "fixture" },
    configure: () => ({ origin }),
    connect: () => ({ submit: async (r) => records.push(r) }),
    clientAddress: () => "fixture-client",
  });
  const call = (path, body, headers = {}, method = "POST") =>
    run(
      new Request(origin + "/api/" + path, {
        method,
        headers: { origin, "content-type": "application/json", ...headers },
        body,
      }),
    );
  assert.equal((await call("create-order", undefined, {}, "GET")).status, 405);
  assert.equal(
    (await call("create-order", "{}", { origin: "https://other.invalid" }))
      .status,
    403,
  );
  assert.equal((await call("create-order", "{}")).status, 401);
  assert.equal((await call("create-order", "a".repeat(17000))).status, 413);
  assert.equal(
    (
      await call(
        "submission",
        JSON.stringify({
          kind: "contact",
          email: "sample@example.invalid",
          body: "Hello",
          consent: true,
        }),
      )
    ).status,
    202,
  );
  assert.match(records[0].subject_hash, /^[\da-f]{64}$/);
});
test("Supabase session lookup uses the user bearer and restricts service writes to the configured schema", async () => {
  const calls = [],
    id = "11111111-1111-4111-8111-111111111111";
  const store = stagingStore(
    { url: "https://fixture.invalid", serviceKey: "local-fixture" },
    async (url, opts) => {
      calls.push({ url, opts });
      return Response.json(url.endsWith("/user") ? { id } : true);
    },
  );
  assert.equal(await store.user("Bearer fixture-token"), id);
  assert.equal(calls[0].opts.headers.Authorization, "Bearer fixture-token");
  await store.start(id, id);
  assert.equal(calls[1].opts.headers["Content-Profile"], "folio");
  assert.equal(calls[1].opts.redirect, "error");
});
