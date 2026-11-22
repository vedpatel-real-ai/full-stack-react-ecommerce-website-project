import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import EmbeddedPostgres from "embedded-postgres";
let cluster, root;
const file = (p) => readFile(new URL("../" + p, import.meta.url), "utf8");
before(async () => {
  const dir = await mkdtemp(join(tmpdir(), "folio-db-"));
  const probe = createServer();
  await new Promise((ok, fail) =>
    probe.once("error", fail).listen(0, "127.0.0.1", ok),
  );
  const port = probe.address().port;
  await new Promise((ok) => probe.close(ok));
  cluster = new EmbeddedPostgres({
    databaseDir: join(dir, "data"),
    port,
    user: "postgres",
    password: randomUUID(),
    persistent: false,
    authMethod: "scram-sha-256",
    postgresFlags: ["-h", "127.0.0.1", "-k", dir],
    onLog: () => {},
    onError: () => {},
  });
  await cluster.initialise();
  await cluster.start();
  root = cluster.getPgClient("postgres", "127.0.0.1");
  await root.connect();
  await root.query(await file("src/demo/bootstrap.sql"));
  for (const name of (await readdir("supabase/migrations")).sort())
    await root.query(await file("supabase/migrations/" + name));
  await root.query(await file("src/demo/seed.sql"));
});
after(async () => {
  await root?.end();
  await cluster?.stop();
});
async function query(role, who, sql, args = []) {
  const conn = cluster.getPgClient("postgres", "127.0.0.1");
  await conn.connect();
  try {
    await conn.query("begin");
    await conn.query("set local role " + role);
    await conn.query("select set_config('request.jwt.claim.sub',$1,true)", [
      who ?? "",
    ]);
    const r = await conn.query(sql, args);
    await conn.query("commit");
    return r.rows;
  } finally {
    await conn.end();
  }
}
async function user(staff = false) {
  const id = randomUUID();
  await root.query("insert into auth.users values($1)", [id]);
  if (staff) await root.query("insert into folio.staff values($1)", [id]);
  return id;
}
const shopper = (id, sql, args) => query("authenticated", id, sql, args);
const service = (sql, args) => query("service_role", null, sql, args);
const add = (id, token = randomUUID(), qty = 1) =>
  shopper(id, "select folio.change_cart($1,$2)", [token, { "ledger-a6": qty }]);
const bag = async (id) =>
  (await shopper(id, "select folio.my_basket() b"))[0].b;
const create = (who, attempt, expected, method = "online") =>
  service("select folio.quoted_checkout($1,$2,$3,$4,$5,$6) id", [
    who,
    attempt,
    JSON.stringify(expected),
    "Sample studio",
    method,
    { shipping: 0, taxBps: 0 },
  ]);
async function payable(method = "online") {
  const who = await user();
  await add(who);
  const [o] = await create(who, randomUUID(), await bag(who), method);
  return (
    await shopper(who, "select * from folio.orders where id=$1", [o.id])
  )[0];
}
const evidence = (o, outcome, ref = "tracking-" + o.reference) =>
  service("select folio.evidence($1,$2,$3,$4,$5)", [
    o.reference,
    o.amount,
    "INR",
    ref,
    outcome,
  ]);
test("database prices use integer half-up rounding, positive minor units and validated inputs", async () => {
  const {
    rows: [r],
  } = await root.query(
    "select folio.unit_price(101,5000) half,folio.unit_price(100,9999) floor,folio.unit_price(200,0) full",
  );
  assert.deepEqual(r, { half: 51, floor: 1, full: 200 });
  for (const [price, discount] of [
    [-1, 0],
    [100, 10000],
    [100, -1],
    [10000001, 0],
  ])
    await assert.rejects(
      root.query("update folio.catalog set price=$1,discount=$2 where sku=$3", [
        price,
        discount,
        "ledger-a6",
      ]),
      /check constraint/,
    );
});
test("cart mutations serialize across connections and replay without adding quantities twice", async () => {
  const id = await user(),
    token = randomUUID();
  await Promise.all([add(id, token), add(id, token), add(id)]);
  assert.equal((await bag(id))[0].qty, 2);
  await assert.rejects(add(id, token, 3), /conflict/i);
  await assert.rejects(add(id, randomUUID(), 20), /Quantity/);
  assert.equal((await bag(id))[0].qty, 2);
});
test("same checkout resumes its snapshot, fresh attempts cannot spend an already transferred cart", async () => {
  const who = await user();
  await add(who);
  const lines = await bag(who),
    attempt = randomUUID();
  await assert.rejects(
    create(who, attempt, [{ ...lines[0], unit: 1 }]),
    /Basket changed/,
  );
  const [a, b] = await Promise.all([
    create(who, attempt, lines),
    create(who, attempt, lines),
  ]);
  assert.equal(a[0].id, b[0].id);
  await assert.rejects(create(who, randomUUID(), lines), /Basket changed/);
  assert.deepEqual(await bag(who), []);
  const [o] = await shopper(who, "select * from folio.orders");
  assert.equal(o.lines[0].variant, "A6 / Ochre");
  assert.equal(o.amount, "32000");
  assert.match(o.reference, /^F\d{1,19}$/);
});
test("RLS isolates customer orders, carts, addresses, profiles and privileged writes", async () => {
  const o = await payable(),
    other = await user();
  assert.deepEqual(
    await shopper(other, "select destination from folio.orders where id=$1", [
      o.id,
    ]),
    [],
  );
  assert.deepEqual(
    await shopper(other, "select * from folio.profiles where owner=$1", [
      o.owner,
    ]),
    [],
  );
  for (const sql of [
    "update folio.orders set payment='captured'",
    "delete from folio.orders",
    "insert into folio.staff values(auth.uid())",
    "select * from folio.tracking",
    "select * from folio.limits",
    "select folio.claim_due(1)",
  ])
    await assert.rejects(shopper(other, sql), /permission denied/);
  assert.equal(
    (await query("anon", null, "select sku from folio.catalog")).length,
    5,
  );
  await assert.rejects(
    query("anon", null, "select * from folio.orders"),
    /permission denied/,
  );
});
test("out-of-order evidence and concurrent replay preserve capture and a later cart", async () => {
  const o = await payable();
  await add(o.owner);
  await evidence(o, "declined");
  await Promise.all([evidence(o, "captured"), evidence(o, "captured")]);
  await evidence(o, "cancelled");
  const [updated] = await shopper(
    o.owner,
    "select payment,phase from folio.orders",
  );
  assert.deepEqual(updated, { payment: "captured", phase: "resolved" });
  assert.equal((await bag(o.owner))[0].qty, 1);
  const { rows } = await root.query(
    "select kind from folio.events where order_id=$1 and kind='captured'",
    [o.id],
  );
  assert.equal(rows.length, 1);
  await evidence(o, "refunded");
  await evidence(o, "captured");
  assert.equal(
    (await shopper(o.owner, "select payment from folio.orders"))[0].payment,
    "refunded",
  );
});
test("one tracking reference cannot confirm two payables and mismatches roll back", async () => {
  const a = await payable(),
    b = await payable();
  const results = await Promise.allSettled([
    evidence(a, "captured", "shared-ref"),
    evidence(b, "captured", "shared-ref"),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  await assert.rejects(
    service("select folio.evidence($1,$2,$3,$4,$5)", [
      a.reference,
      100,
      "USD",
      "other",
      "captured",
    ]),
    /mismatch/,
  );
  const { rows } = await root.query(
    "select count(*) n from folio.tracking where ref='other'",
  );
  assert.equal(rows[0].n, "0");
});
test("staff fulfilment and COD collection require the right channel, sequence and note", async () => {
  const admin = await user(true),
    o = await payable("cod"),
    online = await payable();
  const move = (id, action) =>
    shopper(admin, "select folio.staff_action($1,$2,$3)", [
      id,
      action,
      "Mock delivery note",
    ]);
  await assert.rejects(move(online.id, "packing"), /Transition/);
  await assert.rejects(move(o.id, "cod-collected"), /Transition/);
  await assert.rejects(evidence(o, "captured"), /mismatch/);
  for (const action of [
    "packing",
    "shipped",
    "delivered",
    "cod-collected",
    "archive",
  ])
    await move(o.id, action);
  await assert.rejects(
    shopper(admin, "delete from folio.orders"),
    /permission denied/,
  );
  await assert.rejects(
    root.query("delete from folio.events where order_id=$1", [o.id]),
    /retained/,
  );
});
test("contact and reviews have consent, staff visibility, moderation and per-subject limits", async () => {
  const who = await user(),
    admin = await user(true);
  await shopper(
    who,
    "insert into folio.reviews(owner,sku,rating,body) values(auth.uid(),$1,4,$2)",
    ["ledger-a6", "A sample review"],
  );
  assert.deepEqual(
    await query("anon", null, "select body from folio.reviews"),
    [],
  );
  await shopper(admin, "update folio.reviews set published=true");
  assert.equal(
    (await query("anon", null, "select body from folio.reviews"))[0].body,
    "A sample review",
  );
  const submit = (agreed) =>
    service("select folio.submit_message($1,$2,$3,$4,$5)", [
      "contact",
      "test@example.invalid",
      "Sample text",
      agreed,
      who,
    ]);
  await assert.rejects(submit(false), /check constraint/);
  for (let i = 0; i < 5; i++) await submit(true);
  await assert.rejects(submit(true), /try again/);
  assert.deepEqual(await shopper(who, "select * from folio.inbox"), []);
  assert.equal((await shopper(admin, "select * from folio.inbox")).length, 5);
});
test("reconciliation claims due work once across concurrent workers", async () => {
  const o = await payable();
  await root.query(
    "update folio.orders set next_check=now()-interval '1 hour' where id=$1",
    [o.id],
  );
  const batches = await Promise.all([
    service("select * from folio.claim_due(25)"),
    service("select * from folio.claim_due(25)"),
  ]);
  assert.equal(
    batches.flat().filter((r) => r.reference === o.reference).length,
    1,
  );
});
test("handoff is single-use and multiple capture references flag an exception", async () => {
  const o = await payable();
  const begin = () =>
    service("select folio.start_gateway($1,$2) started", [o.owner, o.id]);
  const results = await Promise.all([begin(), begin()]);
  assert.equal(results.flat().filter((r) => r.started).length, 1);
  await evidence(o, "captured", "first-capture");
  await evidence(o, "captured", "second-capture");
  const [r] = await shopper(
    o.owner,
    "select disputed_evidence,phase from folio.orders where id=$1",
    [o.id],
  );
  assert.deepEqual(r, { disputed_evidence: true, phase: "reconciling" });
  await assert.rejects(
    root.query("update folio.orders set subtotal=1 where id=$1", [o.id]),
    /immutable/,
  );
});
test("fee changes require fresh review and statements retain the committed policy amounts", async () => {
  const who = await user();
  await add(who);
  const lines = await bag(who);
  await root.query(
    "update folio.price_policy set shipping_paise=1250,added_tax_bps=725",
  );
  try {
    await assert.rejects(create(who, randomUUID(), lines), /Basket changed/);
    const [o] = await service(
      "select folio.quoted_checkout($1,$2,$3,$4,$5,$6) id",
      [
        who,
        randomUUID(),
        JSON.stringify(lines),
        "Sample studio",
        "online",
        { shipping: 1250, taxBps: 725 },
      ],
    );
    const [r] = await shopper(
      who,
      "select amount,tax,shipping_fee from folio.orders where id=$1",
      [o.id],
    );
    assert.deepEqual(r, { amount: "35570", tax: "2320", shipping_fee: 1250 });
  } finally {
    await root.query(
      "update folio.price_policy set shipping_paise=0,added_tax_bps=0",
    );
  }
});
test("a refund request is audited once and never refunds a payment", async () => {
  const o = await payable(),
    admin = await user(true);
  await evidence(o, "captured");
  const request = () =>
    shopper(admin, "select folio.request_refund($1,$2)", [
      o.id,
      "Customer requested review",
    ]);
  await Promise.all([request(), request()]);
  assert.equal(
    (await shopper(o.owner, "select payment from folio.orders"))[0].payment,
    "captured",
  );
  assert.equal(
    (
      await root.query(
        "select count(*) n from folio.events where order_id=$1 and kind='refund-requested'",
        [o.id],
      )
    ).rows[0].n,
    "1",
  );
  await evidence(o, "chargeback");
  assert.equal(
    (await shopper(o.owner, "select payment from folio.orders"))[0].payment,
    "chargeback",
  );
});
test("catalog media requires a staff owner and bounded, ordered slots", async () => {
  const admin = await user(true),
    who = await user(),
    sku = "ledger-a5";
  const bytes = Buffer.from("RIFF0000WEBP-synthetic-fixture").toString(
    "base64",
  );
  const put = (id, slot) =>
    service("select folio.replace_image($1,$2,$3::smallint,$4)", [
      id,
      sku,
      slot,
      bytes,
    ]);
  await assert.rejects(put(who, 1), /Staff/);
  await assert.rejects(put(admin, 5), /check constraint/);
  await put(admin, 2);
  await put(admin, 1);
  assert.deepEqual(
    (await query("anon", null, "select slot from folio.images($1)", [sku])).map(
      (r) => r.slot,
    ),
    [1, 2],
  );
  await shopper(admin, "select folio.remove_image($1,1::smallint)", [sku]);
  assert.equal(
    (await query("anon", null, "select slot from folio.images($1)", [sku]))
      .length,
    1,
  );
});
